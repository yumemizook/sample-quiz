import { getAuth, onAuthStateChanged, updateProfile, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "./firebase.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc } from "./firebase.js";
import { calculatePlayerLevel } from "./stats.js";
import { applySiteBackground, removeSiteBackground } from "./loadBackground.js";
import { applyColorTheme } from "./loadTheme.js";

const auth = getAuth();
const db = getFirestore();

const IMGBB_API_KEY = '74c1612dc87c46d5879b1e76f59c40fa';

// Upload image to ImgBB
async function uploadToImgBB(file) {
    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', file);
    
    const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.error?.message || 'Failed to upload image');
    }
    
    return data.data.url;
}

// Format relative timestamp (e.g., "2 days ago", "3 months ago")
function formatRelativeTime(timestamp) {
    if (!timestamp) return "Unknown";
    
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
    return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
}

// Get badge emoji for level
function getBadgeForLevel(level) {
    if (level >= 1000) return "🌠";
    if (level >= 900) return "🌙";
    if (level >= 800) return "☀️";
    if (level >= 700) return "🌍";
    if (level >= 600) return "🪐";
    if (level >= 500) return "⭐";
    if (level >= 400) return "🌟";
    if (level >= 300) return "💫";
    if (level >= 250) return "🌌";
    if (level >= 200) return "🌠";
    if (level >= 150) return "⚛️";
    if (level >= 120) return "🔮";
    if (level >= 100) return "✨";
    if (level >= 80) return "🏆";
    if (level >= 70) return "👑";
    if (level >= 60) return "💎";
    if (level >= 50) return "⭐";
    if (level >= 40) return "🔥";
    if (level >= 35) return "⚡";
    if (level >= 30) return "🌟";
    if (level >= 25) return "💫";
    if (level >= 20) return "⭐";
    if (level >= 15) return "🌟";
    if (level >= 10) return "✨";
    if (level >= 5) return "🌱";
    return "🌿";
}

// Get badge name for level
function getBadgeName(level) {
    if (level >= 1000) return "Meteor";
    if (level >= 900) return "Moon";
    if (level >= 800) return "Sun";
    if (level >= 700) return "Earth";
    if (level >= 600) return "Planet";
    if (level >= 500) return "Star";
    if (level >= 400) return "Glowing Star";
    if (level >= 300) return "Dizzy Star";
    if (level >= 250) return "Galaxy";
    if (level >= 200) return "Shooting Star";
    if (level >= 150) return "Atomic";
    if (level >= 120) return "Crystal";
    if (level >= 100) return "Sparkle";
    if (level >= 80) return "Champion";
    if (level >= 70) return "Royal";
    if (level >= 60) return "Diamond";
    if (level >= 50) return "Star";
    if (level >= 40) return "Fire";
    if (level >= 35) return "Lightning";
    if (level >= 30) return "Shining Star";
    if (level >= 25) return "Dizzy Star";
    if (level >= 20) return "Star";
    if (level >= 15) return "Glowing Star";
    if (level >= 10) return "Sparkle";
    if (level >= 5) return "Sprout";
    return "Seedling";
}

// Find best score for each mode
function findBestScore(scores, mode) {
    if (!scores || scores.length === 0) return null;
    
    if (mode === 'race') {
        // For race mode, prefer GM grades with time, otherwise highest score
        const gmScores = scores.filter(s => s.grade === "GM" && s.time);
        if (gmScores.length > 0) {
            // Sort by time (ascending) and return the fastest
            return gmScores.sort((a, b) => {
                const timeA = parseTime(a.time);
                const timeB = parseTime(b.time);
                return timeA - timeB;
            })[0];
        }
        // If no GM scores with time, return highest score
        return scores.sort((a, b) => b.score - a.score)[0];
    } else if (mode === 'easy') {
        // For easy mode, just return highest score
        return scores.sort((a, b) => b.score - a.score)[0];
    } else {
        // For normal, master, hell: if player reached Grand Master or Grand Master - Infinity,
        // determine best play by shortest time completed
        const gmScores = scores.filter(s => 
            (s.grade === "Grand Master" || s.grade === "Grand Master - Infinity") && s.time
        );
        
        if (gmScores.length > 0) {
            // Sort by time (ascending) and return the fastest
            return gmScores.sort((a, b) => {
                const timeA = parseTime(a.time);
                const timeB = parseTime(b.time);
                return timeA - timeB;
            })[0];
        }
        
        // If no GM scores, sort by score descending
        return scores.sort((a, b) => b.score - a.score)[0];
    }
}

// Parse time string to milliseconds
function parseTime(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
}

// Load banner with error handling
function loadBanner(foundUser, bannerEl) {
    if (!bannerEl) return;
    
    // Always ensure banner is visible
    bannerEl.style.display = 'block';
    
    if (foundUser && foundUser.bannerURL) {
        // Create a new image to test if the banner URL loads
        const testImg = new Image();
        testImg.onload = () => {
            // Image loaded successfully
            bannerEl.style.backgroundImage = `url(${foundUser.bannerURL})`;
            bannerEl.style.backgroundSize = 'cover';
            bannerEl.style.backgroundPosition = 'center';
        };
        testImg.onerror = () => {
            // Image failed to load, use default gradient
            console.warn('Banner image failed to load:', foundUser.bannerURL);
            bannerEl.style.backgroundImage = 'linear-gradient(135deg, rgba(76, 175, 80, 0.3), rgba(69, 160, 73, 0.3))';
        };
        testImg.src = foundUser.bannerURL;
    } else {
        // No banner URL, use default gradient
        bannerEl.style.backgroundImage = 'linear-gradient(135deg, rgba(76, 175, 80, 0.3), rgba(69, 160, 73, 0.3))';
    }
}

// Load About Me text
function loadAboutMe(foundUser) {
    const aboutMeDisplay = document.getElementById('aboutMeDisplay');
    if (!aboutMeDisplay) return;
    
    const aboutMeText = foundUser && foundUser.aboutMe ? foundUser.aboutMe : '';
    if (aboutMeText) {
        aboutMeDisplay.textContent = aboutMeText;
        aboutMeDisplay.style.color = '';
        aboutMeDisplay.style.fontStyle = '';
    } else {
        aboutMeDisplay.textContent = 'No bio yet.';
        aboutMeDisplay.style.color = 'rgba(255, 255, 255, 0.5)';
        aboutMeDisplay.style.fontStyle = 'italic';
    }
}

// Format score for display
// Format grade to shorthand
function formatGrade(grade) {
    if (!grade || grade === "-") return "";
    if (grade === "Grand Master - Infinity") return "GM-∞";
    if (grade === "Grand Master") return "GM";
    return grade;
}

// Get line color hex code
function getLineColor(scoreData) {
    if (!scoreData || !scoreData.line) return "#ffffff";
    const lineColor = scoreData.line;
    if (lineColor === "orange") return "#ff8800";
    if (lineColor === "green") return "#00ff00";
    return "#ffffff";
}

// Format modifiers display
function formatModifiers(modifiers) {
    if (!modifiers || Object.keys(modifiers).length === 0) return "";
    const parts = [];
    if (modifiers.lives) {
        parts.push(`❤️ ${modifiers.lives}`);
    }
    if (modifiers.timeMultiplier && modifiers.timeMultiplier !== 1) {
        parts.push(`⏱️ ${modifiers.timeMultiplier.toFixed(2)}x`);
    }
    if (modifiers.fadingMode) {
        parts.push(`👁️ ${modifiers.fadingMode}s`);
    }
    if (modifiers.startQuestion) {
        parts.push(`🎯 ${modifiers.startQuestion + 1}`);
    }
    return parts.length > 0 ? parts.join(' ') : "";
}

function formatScore(scoreData, mode) {
    if (!scoreData) return '-';
    
    if (mode === 'race') {
        const isCompleted = scoreData.grade === "GM";
        if (isCompleted && scoreData.time) {
            return scoreData.time;
        } else {
            return scoreData.score.toLocaleString();
        }
    } else if (mode === 'hell') {
        // For hell mode, if score is 200 (completed), hide score and show time instead
        if (scoreData.score === 200) {
            return ''; // Score will be hidden, time shown separately
        }
        // For hell mode, include grade in score value to avoid duplicate in details
        const grade = formatGrade(scoreData.grade);
        const gradeDisplay = grade ? ` - ${grade}` : '';
        return `${scoreData.score}${gradeDisplay}`;
    } else if (mode === 'normal' || mode === 'master') {
        // Don't include grade here - it's shown in details
        return scoreData.score.toString();
    } else {
        return scoreData.score.toString();
    }
}

// Format score details (grade with line color, modifiers)
function formatScoreDetails(scoreData, mode, hideGrade = false) {
    if (!scoreData) return '';
    
    const parts = [];
    
    // Add grade with line color (unless hidden for hell mode to avoid duplicate)
    if (!hideGrade && scoreData.grade && (mode === 'normal' || mode === 'master' || mode === 'hell')) {
        const grade = formatGrade(scoreData.grade);
        const lineColor = getLineColor(scoreData);
        parts.push(`<span style="color: ${lineColor};">${grade}</span>`);
    }
    
    // Add modifiers
    const modifiers = formatModifiers(scoreData.modifiers);
    if (modifiers) {
        parts.push(`<span style="color: rgba(255, 255, 255, 0.7); font-size: 0.9em;">${modifiers}</span>`);
    }
    
    return parts.length > 0 ? parts.join(' • ') : '';
}

// Load player profile
async function loadProfile() {
    // Get player name from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const playerName = urlParams.get('player');
    
    if (!playerName) {
        const notFoundEl = document.getElementById('playerNotFound');
        if (notFoundEl) {
            notFoundEl.style.display = 'block';
        }
        return;
    }
    
    // Fetch all scores
    const easyModeRef = collection(db, 'scoreseasy');
    const normalModeRef = collection(db, 'scoresnormal');
    const masterModeRef = collection(db, 'scoresmaster');
    const raceModeRef = collection(db, 'scoresrace');
    const hellModeRef = collection(db, 'scoresfinal');
    
    const [easySnapshot, normalSnapshot, masterSnapshot, raceSnapshot, hellSnapshot] = await Promise.all([
        getDocs(easyModeRef),
        getDocs(normalModeRef),
        getDocs(masterModeRef),
        getDocs(raceModeRef),
        getDocs(hellModeRef)
    ]);
    
    const allEasyScores = easySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allNormalScores = normalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allMasterScores = masterSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allRaceScores = raceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allHellScores = hellSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Check if player exists in userProfiles FIRST to get previous usernames
    const userProfilesRef = collection(db, 'userProfiles');
    const userProfilesSnapshot = await getDocs(userProfilesRef);
    
    let foundUser = null;
    const isEmail = playerName.includes('@');
    
    userProfilesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.displayName === playerName || 
            (isEmail && data.email === playerName) ||
            (isEmail && playerName === data.displayName)) {
            foundUser = { uid: doc.id, ...data };
        }
    });
    
    if (!foundUser) {
        userProfilesSnapshot.forEach(doc => {
            const data = doc.data();
            if ((data.email && data.email === playerName) || 
                (data.displayName && data.displayName === playerName)) {
                foundUser = { uid: doc.id, ...data };
            }
        });
    }
    
    // Build list of all names (current + previous usernames) for score filtering
    const allPlayerNames = new Set();
    if (foundUser) {
        // Add current display name
        if (foundUser.displayName) {
            allPlayerNames.add(foundUser.displayName);
        }
        // Add email if it's being used as identifier
        if (isEmail && foundUser.email) {
            allPlayerNames.add(foundUser.email);
        }
        // Add all previous usernames
        if (foundUser.previousUsernames && Array.isArray(foundUser.previousUsernames)) {
            foundUser.previousUsernames.forEach(name => {
                if (name) allPlayerNames.add(name);
            });
        }
    }
    // Also add the playerName from URL in case it's not in the user profile
    allPlayerNames.add(playerName);
    
    // Filter scores for this player (including all previous usernames)
    const easyScores = allEasyScores.filter(s => allPlayerNames.has(s.name));
    const normalScores = allNormalScores.filter(s => allPlayerNames.has(s.name));
    const masterScores = allMasterScores.filter(s => allPlayerNames.has(s.name));
    const raceScores = allRaceScores.filter(s => allPlayerNames.has(s.name));
    const hellScores = allHellScores.filter(s => allPlayerNames.has(s.name));
    
    // If player not found, show not found message
    if (!foundUser) {
        document.getElementById('playerNotFound').style.display = 'block';
        document.getElementById('profileContent').style.display = 'none';
        return;
    }
    
    // Player found - display profile
    document.getElementById('playerNotFound').style.display = 'none';
    const profileContent = document.getElementById('profileContent');
    profileContent.style.display = 'block';
    
    // Add class to container2 to trigger padding
    const container2 = document.querySelector('.container2');
    if (container2) {
        container2.classList.add('has-profile-banner');
    }
    
    // Ensure banner section is visible
    const bannerSection = profileContent.querySelector('.profile-banner-section');
    if (bannerSection) {
        bannerSection.style.display = 'block';
    }
    
    // Set player name
    document.getElementById('profileName').textContent = playerName;
    
    // Calculate level
    const secretScores = [];
    const playerData = calculatePlayerLevel(easyScores, normalScores, masterScores, hellScores, secretScores, raceScores);
    const badge = getBadgeForLevel(playerData.level);
    const badgeName = getBadgeName(playerData.level);
    
    document.getElementById('profileBadge').textContent = badge;
    document.getElementById('profileLevelText').textContent = `Lv. ${playerData.level} (${badgeName})`;
    
    // Set created date
    const createdEl = document.getElementById('profileCreated');
    if (foundUser.createdAt) {
        createdEl.textContent = `Joined ${formatRelativeTime(foundUser.createdAt)}`;
    } else {
        createdEl.textContent = '';
    }
    
    // Display previous usernames
    const previousUsernamesEl = document.getElementById('previousUsernames');
    const previousUsernamesListEl = document.getElementById('previousUsernamesList');
    if (previousUsernamesEl && previousUsernamesListEl) {
        const previousUsernames = foundUser.previousUsernames || [];
        if (previousUsernames.length > 0) {
            previousUsernamesEl.style.display = 'block';
            previousUsernamesListEl.innerHTML = previousUsernames.map(name => 
                `<span class="profile-previous-name">${name}</span>`
            ).join(', ');
        } else {
            previousUsernamesEl.style.display = 'none';
        }
    }
    
    // Load avatar
    const avatarImg = document.getElementById('profileAvatar');
    const avatarPlaceholder = document.getElementById('profileAvatarPlaceholder');
    const avatarURL = foundUser.photoURL || foundUser.avatarURL;
    
    if (avatarURL) {
        avatarImg.onload = () => {
            avatarImg.classList.add('show');
            avatarPlaceholder.classList.add('hide');
        };
        avatarImg.onerror = () => {
            avatarImg.classList.remove('show');
            avatarPlaceholder.classList.remove('hide');
            avatarImg.src = '';
        };
        avatarImg.src = avatarURL;
    } else {
        avatarImg.classList.remove('show');
        avatarPlaceholder.classList.remove('hide');
        avatarImg.src = '';
    }
    
    // Load banner - always show the banner section, even if no banner URL
    const bannerEl = document.getElementById('profileBanner');
    // Always ensure banner is visible - never set display to none
    bannerEl.style.display = 'block';
    
    loadBanner(foundUser, bannerEl);
    
    // Retry loading banner if it failed
    let bannerRetryCount = 0;
    const maxBannerRetries = 5;
    const bannerRetryInterval = setInterval(async () => {
        if (bannerRetryCount >= maxBannerRetries) {
            clearInterval(bannerRetryInterval);
            return;
        }
        
        // Re-fetch user profile to get updated banner URL
        try {
            const userProfileRef = doc(db, 'userProfiles', foundUser.uid);
            const userProfileSnap = await getDoc(userProfileRef);
            if (userProfileSnap.exists()) {
                const updatedUser = userProfileSnap.data();
                if (updatedUser.bannerURL && updatedUser.bannerURL !== foundUser.bannerURL) {
                    foundUser.bannerURL = updatedUser.bannerURL;
                    loadBanner(foundUser, bannerEl);
                    clearInterval(bannerRetryInterval);
                }
            }
        } catch (error) {
            console.error('Error retrying banner fetch:', error);
        }
        
        bannerRetryCount++;
    }, 2000); // Retry every 2 seconds
    
    // Find and display best scores
    const bestEasy = findBestScore(easyScores, 'easy');
    const bestNormal = findBestScore(normalScores, 'normal');
    const bestMaster = findBestScore(masterScores, 'master');
    const bestRace = findBestScore(raceScores, 'race');
    const bestHell = findBestScore(hellScores, 'hell');
    
    // Display scores with line color
    const easyScoreEl = document.getElementById('easyScore');
    const normalScoreEl = document.getElementById('normalScore');
    const masterScoreEl = document.getElementById('masterScore');
    const raceScoreEl = document.getElementById('raceScore');
    const hellScoreEl = document.getElementById('hellScore');
    const hellScoreTimeEl = document.getElementById('hellScoreTime');
    
    easyScoreEl.textContent = formatScore(bestEasy, 'easy');
    normalScoreEl.textContent = formatScore(bestNormal, 'normal');
    masterScoreEl.textContent = formatScore(bestMaster, 'master');
    raceScoreEl.textContent = formatScore(bestRace, 'race');
    
    // Special handling for hell mode: if score is 200, show time above and hide score
    if (bestHell && bestHell.score === 200 && bestHell.time) {
        hellScoreTimeEl.textContent = bestHell.time;
        hellScoreTimeEl.style.display = 'block';
        hellScoreEl.textContent = ''; // Hide score
        hellScoreEl.style.display = 'none';
        // Apply line color to time
        hellScoreTimeEl.style.color = getLineColor(bestHell);
    } else {
        hellScoreEl.textContent = formatScore(bestHell, 'hell');
        hellScoreTimeEl.style.display = 'none';
        hellScoreEl.style.display = 'block';
    }
    
    // Apply line color to score values
    if (bestEasy) {
        easyScoreEl.style.color = getLineColor(bestEasy);
    }
    if (bestNormal) {
        normalScoreEl.style.color = getLineColor(bestNormal);
    }
    if (bestMaster) {
        masterScoreEl.style.color = getLineColor(bestMaster);
    }
    if (bestRace) {
        raceScoreEl.style.color = getLineColor(bestRace);
    }
    if (bestHell && bestHell.score !== 200) {
        // Only apply color to score if it's not hidden (score !== 200)
        hellScoreEl.style.color = getLineColor(bestHell);
    }
    
    // Display score details (grade with line color, modifiers)
    // For hell mode, don't show grade in details since it's already shown in the score value area
    document.getElementById('easyScoreDetails').innerHTML = formatScoreDetails(bestEasy, 'easy');
    document.getElementById('normalScoreDetails').innerHTML = formatScoreDetails(bestNormal, 'normal');
    document.getElementById('masterScoreDetails').innerHTML = formatScoreDetails(bestMaster, 'master');
    document.getElementById('raceScoreDetails').innerHTML = formatScoreDetails(bestRace, 'race');
    document.getElementById('hellScoreDetails').innerHTML = formatScoreDetails(bestHell, 'hell');
    
    // Load "About Me" text
    loadAboutMe(foundUser);
    
    // Retry loading about me if it's missing
    let aboutMeRetryCount = 0;
    const maxAboutMeRetries = 5;
    const aboutMeRetryInterval = setInterval(async () => {
        if (aboutMeRetryCount >= maxAboutMeRetries) {
            clearInterval(aboutMeRetryInterval);
            return;
        }
        
        // Re-fetch user profile to get updated about me
        try {
            const userProfileRef = doc(db, 'userProfiles', foundUser.uid);
            const userProfileSnap = await getDoc(userProfileRef);
            if (userProfileSnap.exists()) {
                const updatedUser = userProfileSnap.data();
                if (updatedUser.aboutMe !== foundUser.aboutMe) {
                    foundUser.aboutMe = updatedUser.aboutMe;
                    loadAboutMe(foundUser);
                    // If we got the about me, we can stop retrying
                    if (updatedUser.aboutMe) {
                        clearInterval(aboutMeRetryInterval);
                    }
                }
            }
        } catch (error) {
            console.error('Error retrying about me fetch:', error);
        }
        
        aboutMeRetryCount++;
    }, 2000); // Retry every 2 seconds
    
    // Check if viewing own profile
    let isOwnProfile = false;
    onAuthStateChanged(auth, (user) => {
        if (user && foundUser) {
            const currentUserDisplayName = user.displayName || user.email;
            isOwnProfile = (currentUserDisplayName === playerName) || 
                          (user.email === playerName) ||
                          (user.uid === foundUser.uid);
            
            if (isOwnProfile) {
                // Show profile settings
                document.getElementById('profileSettings').style.display = 'block';
                document.getElementById('editAboutMeBtn').style.display = 'block';
                
                // Load current user's profile data for settings
                loadUserProfileSettings(user, foundUser);
            } else {
                // Hide profile settings
                document.getElementById('profileSettings').style.display = 'none';
                document.getElementById('editAboutMeBtn').style.display = 'none';
            }
        }
    });
    
    // Load graph data after profile is loaded
    updateGraph();
}

function showStatus(elementId, message, isError = false) {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `status-message ${isError ? 'error' : 'success'}`;
    statusEl.style.display = 'block';
    setTimeout(() => {
        statusEl.className = 'status-message';
        statusEl.textContent = '';
        statusEl.style.display = 'none';
    }, 5000);
}

async function loadUserProfileSettings(user, foundUser) {
    // Load display name
    if (user.displayName) {
        document.getElementById('displayNameInput').value = user.displayName;
    }
    
    // Check and display time until next name change
    const displayNameStatus = document.getElementById('displayNameStatus');
    if (foundUser && foundUser.lastNameChange) {
        const lastChange = foundUser.lastNameChange.toDate ? foundUser.lastNameChange.toDate() : new Date(foundUser.lastNameChange);
        const now = new Date();
        const daysSinceLastChange = (now - lastChange) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastChange < 7) {
            const daysRemaining = Math.ceil(7 - daysSinceLastChange);
            displayNameStatus.textContent = `You can change your display name again in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.`;
            displayNameStatus.style.display = 'block';
            displayNameStatus.style.color = 'rgba(255, 255, 255, 0.7)';
        } else {
            displayNameStatus.style.display = 'none';
        }
    }
    
    // Load email
    if (user.email) {
        document.getElementById('emailInput').placeholder = `Current: ${user.email}`;
    }
    
    // Load avatar
    const avatarPreview = document.getElementById('avatarPreview');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    const avatarURL = foundUser.photoURL || foundUser.avatarURL;
    
    if (avatarURL && avatarPreview && avatarPlaceholder) {
        avatarPreview.src = avatarURL;
        avatarPreview.classList.add('show');
        avatarPreview.style.display = 'block';
        avatarPlaceholder.classList.add('hide');
        document.getElementById('avatarRemoveBtn').style.display = 'block';
    }
    
    // Load banner
    const bannerPreview = document.getElementById('bannerPreview');
    const bannerPlaceholder = document.getElementById('bannerPlaceholder');
    if (foundUser.bannerURL && bannerPreview && bannerPlaceholder) {
        bannerPreview.src = foundUser.bannerURL;
        bannerPreview.classList.add('show');
        bannerPreview.style.display = 'block';
        // Banner preview should have different dimensions
        bannerPreview.style.width = '100%';
        bannerPreview.style.maxWidth = '400px';
        bannerPreview.style.height = '120px';
        bannerPreview.style.borderRadius = '10px';
        bannerPreview.style.objectFit = 'cover';
        bannerPlaceholder.classList.add('hide');
        document.getElementById('bannerRemoveBtn').style.display = 'block';
    }
    
    // Load about me for editing
    const aboutMeTextarea = document.getElementById('aboutMeTextarea');
    if (aboutMeTextarea) {
        aboutMeTextarea.value = foundUser.aboutMe || '';
    }
    
    // Load site background preview
    const siteBackgroundPreview = document.getElementById('siteBackgroundPreview');
    const siteBackgroundPlaceholder = document.getElementById('siteBackgroundPlaceholder');
    if (foundUser.siteBackgroundURL && siteBackgroundPreview && siteBackgroundPlaceholder) {
        siteBackgroundPreview.src = foundUser.siteBackgroundURL;
        siteBackgroundPreview.classList.add('show');
        siteBackgroundPreview.style.display = 'block';
        siteBackgroundPlaceholder.classList.add('hide');
        document.getElementById('siteBackgroundRemoveBtn').style.display = 'block';
    }
    
    // Load color theme
    const colorThemeSelect = document.getElementById('colorThemeSelect');
    if (colorThemeSelect && foundUser.colorTheme) {
        colorThemeSelect.value = foundUser.colorTheme;
    } else if (colorThemeSelect) {
        colorThemeSelect.value = 'default';
    }
}

function initProfileSettings() {
    let currentUser = null;
    
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
    });
    
    // Toggle settings collapse/expand
    const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
    const settingsContent = document.getElementById('profileSettingsContent');
    
    if (toggleSettingsBtn && settingsContent) {
        // Load collapsed state from localStorage (default: collapsed)
        const isCollapsed = localStorage.getItem('profileSettingsCollapsed') !== 'false';
        if (isCollapsed) {
            toggleSettingsBtn.classList.add('collapsed');
            settingsContent.classList.add('collapsed');
        }
        
        toggleSettingsBtn.addEventListener('click', () => {
            const isCurrentlyCollapsed = toggleSettingsBtn.classList.contains('collapsed');
            
            if (isCurrentlyCollapsed) {
                toggleSettingsBtn.classList.remove('collapsed');
                settingsContent.classList.remove('collapsed');
                localStorage.setItem('profileSettingsCollapsed', 'false');
            } else {
                toggleSettingsBtn.classList.add('collapsed');
                settingsContent.classList.add('collapsed');
                localStorage.setItem('profileSettingsCollapsed', 'true');
            }
        });
    }
    
    // About Me editing
    const editAboutMeBtn = document.getElementById('editAboutMeBtn');
    const saveAboutMeBtn = document.getElementById('saveAboutMeBtn');
    const cancelAboutMeBtn = document.getElementById('cancelAboutMeBtn');
    const aboutMeDisplay = document.getElementById('aboutMeDisplay');
    const aboutMeEdit = document.getElementById('aboutMeEdit');
    const aboutMeTextarea = document.getElementById('aboutMeTextarea');
    
    if (editAboutMeBtn) {
        editAboutMeBtn.addEventListener('click', () => {
            aboutMeDisplay.style.display = 'none';
            editAboutMeBtn.style.display = 'none';
            aboutMeEdit.style.display = 'block';
            aboutMeTextarea.value = aboutMeDisplay.textContent === 'No bio yet.' ? '' : aboutMeDisplay.textContent;
            aboutMeTextarea.focus();
        });
    }
    
    if (cancelAboutMeBtn) {
        cancelAboutMeBtn.addEventListener('click', () => {
            aboutMeEdit.style.display = 'none';
            aboutMeDisplay.style.display = 'block';
            editAboutMeBtn.style.display = 'block';
        });
    }
    
    if (saveAboutMeBtn) {
        saveAboutMeBtn.addEventListener('click', async () => {
            if (!currentUser) return;
            
            const aboutMeText = aboutMeTextarea.value.trim();
            saveAboutMeBtn.disabled = true;
            saveAboutMeBtn.textContent = 'Saving...';
            
            try {
                const userProfileRef = doc(db, 'userProfiles', currentUser.uid);
                await setDoc(userProfileRef, { aboutMe: aboutMeText }, { merge: true });
                
                // Update display
                if (aboutMeText) {
                    aboutMeDisplay.textContent = aboutMeText;
                    aboutMeDisplay.style.color = '';
                    aboutMeDisplay.style.fontStyle = '';
                } else {
                    aboutMeDisplay.textContent = 'No bio yet.';
                    aboutMeDisplay.style.color = 'rgba(255, 255, 255, 0.5)';
                    aboutMeDisplay.style.fontStyle = 'italic';
                }
                
                aboutMeEdit.style.display = 'none';
                aboutMeDisplay.style.display = 'block';
                editAboutMeBtn.style.display = 'block';
                
                showStatus('aboutMeStatus', 'About Me updated successfully!');
            } catch (error) {
                console.error('Error saving about me:', error);
                showStatus('aboutMeStatus', 'Error saving About Me. Please try again.', true);
            } finally {
                saveAboutMeBtn.disabled = false;
                saveAboutMeBtn.textContent = 'Save';
            }
        });
    }
    
    // Avatar Upload
    const avatarUploadBtn = document.getElementById('avatarUploadBtn');
    const avatarInput = document.getElementById('avatarInput');
    const avatarRemoveBtn = document.getElementById('avatarRemoveBtn');
    const avatarPreview = document.getElementById('avatarPreview');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    
    if (avatarUploadBtn && avatarInput) {
        avatarUploadBtn.addEventListener('click', () => {
            avatarInput.click();
        });
        
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !currentUser) return;
            
            if (file.size > 2 * 1024 * 1024) {
                showStatus('avatarStatus', 'File size must be less than 2MB', true);
                return;
            }
            
            if (!file.type.match('image/(jpeg|jpg|png)')) {
                showStatus('avatarStatus', 'Please upload a JPG or PNG image', true);
                return;
            }
            
            avatarUploadBtn.disabled = true;
            avatarUploadBtn.textContent = 'Uploading...';
            
            try {
                const imageURL = await uploadToImgBB(file);
                await updateProfile(currentUser, { photoURL: imageURL });
                
                const userProfileRef = doc(db, 'userProfiles', currentUser.uid);
                await setDoc(userProfileRef, { 
                    avatarURL: imageURL,
                    displayName: currentUser.displayName || currentUser.email
                }, { merge: true });
                
                if (avatarPreview && avatarPlaceholder) {
                    avatarPreview.src = imageURL;
                    avatarPreview.classList.add('show');
                    avatarPreview.style.display = 'block';
                    avatarPlaceholder.classList.add('hide');
                    avatarRemoveBtn.style.display = 'block';
                }
                
                // Reload profile to update avatar display
                window.location.reload();
            } catch (error) {
                console.error('Error uploading avatar:', error);
                showStatus('avatarStatus', 'Error uploading avatar. Please try again.', true);
            } finally {
                avatarUploadBtn.disabled = false;
                avatarUploadBtn.textContent = 'Upload Avatar';
            }
        });
    }
    
    if (avatarRemoveBtn) {
        avatarRemoveBtn.addEventListener('click', async () => {
            if (!currentUser || !confirm('Are you sure you want to remove your avatar?')) return;
            
            avatarRemoveBtn.disabled = true;
            avatarRemoveBtn.textContent = 'Removing...';
            
            try {
                await updateProfile(currentUser, { photoURL: null });
                const userProfileRef = doc(db, 'userProfiles', currentUser.uid);
                await setDoc(userProfileRef, { avatarURL: null }, { merge: true });
                
                if (avatarPreview && avatarPlaceholder) {
                    avatarPreview.classList.remove('show');
                    avatarPreview.style.display = 'none';
                    avatarPlaceholder.classList.remove('hide');
                    avatarRemoveBtn.style.display = 'none';
                }
                
                window.location.reload();
            } catch (error) {
                console.error('Error removing avatar:', error);
                showStatus('avatarStatus', 'Error removing avatar. Please try again.', true);
            } finally {
                avatarRemoveBtn.disabled = false;
                avatarRemoveBtn.textContent = 'Remove';
            }
        });
    }
    
    // Banner Upload
    const bannerUploadBtn = document.getElementById('bannerUploadBtn');
    const bannerInput = document.getElementById('bannerInput');
    const bannerRemoveBtn = document.getElementById('bannerRemoveBtn');
    const bannerPreview = document.getElementById('bannerPreview');
    const bannerPlaceholder = document.getElementById('bannerPlaceholder');
    
    if (bannerUploadBtn && bannerInput) {
        bannerUploadBtn.addEventListener('click', () => {
            bannerInput.click();
        });
        
        bannerInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !currentUser) return;
            
            if (file.size > 5 * 1024 * 1024) {
                showStatus('bannerStatus', 'File size must be less than 5MB', true);
                return;
            }
            
            if (!file.type.match('image/(jpeg|jpg|png)')) {
                showStatus('bannerStatus', 'Please upload a JPG or PNG image', true);
                return;
            }
            
            bannerUploadBtn.disabled = true;
            bannerUploadBtn.textContent = 'Uploading...';
            
            try {
                const imageURL = await uploadToImgBB(file);
                const userProfileRef = doc(db, 'userProfiles', currentUser.uid);
                await setDoc(userProfileRef, { 
                    bannerURL: imageURL,
                    displayName: currentUser.displayName || currentUser.email
                }, { merge: true });
                
                if (bannerPreview && bannerPlaceholder) {
                    bannerPreview.src = imageURL;
                    bannerPreview.classList.add('show');
                    bannerPreview.style.display = 'block';
                    bannerPlaceholder.classList.add('hide');
                    bannerRemoveBtn.style.display = 'block';
                    
                    // Update banner in profile header
                    const profileBanner = document.getElementById('profileBanner');
                    if (profileBanner) {
                        // Always keep banner visible, never set display to none
                        profileBanner.style.display = 'block';
                        profileBanner.style.backgroundImage = `url(${imageURL})`;
                    }
                }
                
                window.location.reload();
            } catch (error) {
                console.error('Error uploading banner:', error);
                showStatus('bannerStatus', 'Error uploading banner. Please try again.', true);
            } finally {
                bannerUploadBtn.disabled = false;
                bannerUploadBtn.textContent = 'Upload Banner';
            }
        });
    }
    
    if (bannerRemoveBtn) {
        bannerRemoveBtn.addEventListener('click', async () => {
            if (!currentUser || !confirm('Are you sure you want to remove your banner?')) return;
            
            bannerRemoveBtn.disabled = true;
            bannerRemoveBtn.textContent = 'Removing...';
            
            try {
                const userProfileRef = doc(db, 'userProfiles', currentUser.uid);
                await setDoc(userProfileRef, { bannerURL: null }, { merge: true });
                
                if (bannerPreview && bannerPlaceholder) {
                    bannerPreview.classList.remove('show');
                    bannerPreview.style.display = 'none';
                    bannerPlaceholder.classList.remove('hide');
                    bannerRemoveBtn.style.display = 'none';
                }
                
                window.location.reload();
            } catch (error) {
                console.error('Error removing banner:', error);
                showStatus('bannerStatus', 'Error removing banner. Please try again.', true);
            } finally {
                bannerRemoveBtn.disabled = false;
                bannerRemoveBtn.textContent = 'Remove';
            }
        });
    }
    
    // Display Name Update
    const displayNameBtn = document.getElementById('displayNameBtn');
    if (displayNameBtn) {
        displayNameBtn.addEventListener('click', async () => {
            if (!currentUser) return;
            
            const newDisplayName = document.getElementById('displayNameInput').value.trim();
            
            if (!newDisplayName) {
                showStatus('displayNameStatus', 'Please enter a display name', true);
                return;
            }
            
            if (newDisplayName.length > 50) {
                showStatus('displayNameStatus', 'Display name must be 50 characters or less', true);
                return;
            }
            
            // Check if name is the same
            if (newDisplayName === currentUser.displayName) {
                showStatus('displayNameStatus', 'This is already your current display name', true);
                return;
            }
            
            displayNameBtn.disabled = true;
            displayNameBtn.textContent = 'Checking...';
            
            try {
                // Check 7-day delay restriction
                const userProfileRef = doc(db, 'userProfiles', currentUser.uid);
                const userProfileSnap = await getDoc(userProfileRef);
                
                let lastNameChange = null;
                let previousUsernames = [];
                
                if (userProfileSnap.exists()) {
                    const userData = userProfileSnap.data();
                    lastNameChange = userData.lastNameChange ? userData.lastNameChange.toDate() : null;
                    previousUsernames = userData.previousUsernames || [];
                }
                
                // Check if 7 days have passed since last name change
                if (lastNameChange) {
                    const now = new Date();
                    const daysSinceLastChange = (now - lastNameChange) / (1000 * 60 * 60 * 24);
                    
                    if (daysSinceLastChange < 7) {
                        const daysRemaining = Math.ceil(7 - daysSinceLastChange);
                        showStatus('displayNameStatus', `You can change your display name again in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.`, true);
                        displayNameBtn.disabled = false;
                        displayNameBtn.textContent = 'Update';
                        return;
                    }
                }
                
                // Get current display name before changing
                const oldDisplayName = currentUser.displayName || currentUser.email || 'Unknown';
                
                // Update display name
                displayNameBtn.textContent = 'Updating...';
                await updateProfile(currentUser, { displayName: newDisplayName });
                
                // Store in Firestore with previous username tracking
                const updateData = {
                    displayName: newDisplayName,
                    lastNameChange: new Date(),
                    previousUsernames: previousUsernames
                };
                
                // Add old display name to previous usernames if it's different and not already in the list
                if (oldDisplayName && oldDisplayName !== newDisplayName && !previousUsernames.includes(oldDisplayName)) {
                    updateData.previousUsernames = [...previousUsernames, oldDisplayName];
                }
                
                await setDoc(userProfileRef, updateData, { merge: true });
                
                showStatus('displayNameStatus', 'Display name updated successfully!');
                window.location.reload();
            } catch (error) {
                console.error('Error updating display name:', error);
                showStatus('displayNameStatus', 'Error updating display name. Please try again.', true);
            } finally {
                displayNameBtn.disabled = false;
                displayNameBtn.textContent = 'Update';
            }
        });
    }
    
    // Email Update
    const emailBtn = document.getElementById('emailBtn');
    if (emailBtn) {
        emailBtn.addEventListener('click', async () => {
            if (!currentUser) return;
            
            const newEmail = document.getElementById('emailInput').value.trim();
            
            if (!newEmail) {
                showStatus('emailStatus', 'Please enter a new email address', true);
                return;
            }
            
            if (newEmail === currentUser.email) {
                showStatus('emailStatus', 'This is already your current email', true);
                return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(newEmail)) {
                showStatus('emailStatus', 'Please enter a valid email address', true);
                return;
            }
            
            emailBtn.disabled = true;
            emailBtn.textContent = 'Updating...';
            
            try {
                await updateEmail(currentUser, newEmail);
                showStatus('emailStatus', 'Email updated successfully! A verification email has been sent.', false);
                document.getElementById('emailInput').value = '';
                document.getElementById('emailInput').placeholder = `Current: ${newEmail}`;
            } catch (error) {
                console.error('Error updating email:', error);
                let errorMessage = 'Error updating email. ';
                
                if (error.code === 'auth/requires-recent-login') {
                    errorMessage += 'Please log out and log back in, then try again.';
                } else if (error.code === 'auth/email-already-in-use') {
                    errorMessage += 'This email is already in use by another account.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage += 'Invalid email address.';
                } else {
                    errorMessage += 'Please try again.';
                }
                
                showStatus('emailStatus', errorMessage, true);
            } finally {
                emailBtn.disabled = false;
                emailBtn.textContent = 'Update';
            }
        });
    }
    
    // Password Update
    const passwordBtn = document.getElementById('passwordBtn');
    if (passwordBtn) {
        passwordBtn.addEventListener('click', async () => {
            if (!currentUser) return;
            
            const currentPassword = document.getElementById('currentPasswordInput').value;
            const newPassword = document.getElementById('newPasswordInput').value;
            const confirmPassword = document.getElementById('confirmPasswordInput').value;
            
            if (!currentPassword || !newPassword || !confirmPassword) {
                showStatus('passwordStatus', 'Please fill in all password fields', true);
                return;
            }
            
            if (newPassword.length < 6) {
                showStatus('passwordStatus', 'New password must be at least 6 characters long', true);
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showStatus('passwordStatus', 'New passwords do not match', true);
                return;
            }
            
            passwordBtn.disabled = true;
            passwordBtn.textContent = 'Updating...';
            
            try {
                const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
                await reauthenticateWithCredential(currentUser, credential);
                await updatePassword(currentUser, newPassword);
                
                document.getElementById('currentPasswordInput').value = '';
                document.getElementById('newPasswordInput').value = '';
                document.getElementById('confirmPasswordInput').value = '';
                
                showStatus('passwordStatus', 'Password updated successfully!');
            } catch (error) {
                console.error('Error updating password:', error);
                let errorMessage = 'Error updating password. ';
                
                if (error.code === 'auth/wrong-password') {
                    errorMessage += 'Current password is incorrect.';
                } else if (error.code === 'auth/weak-password') {
                    errorMessage += 'New password is too weak.';
                } else if (error.code === 'auth/requires-recent-login') {
                    errorMessage += 'Please log out and log back in, then try again.';
                } else {
                    errorMessage += 'Please try again.';
                }
                
                showStatus('passwordStatus', errorMessage, true);
            } finally {
                passwordBtn.disabled = false;
                passwordBtn.textContent = 'Update Password';
            }
        });
    }
    
    // Site Background Upload
    const siteBackgroundUploadBtn = document.getElementById('siteBackgroundUploadBtn');
    const siteBackgroundInput = document.getElementById('siteBackgroundInput');
    const siteBackgroundRemoveBtn = document.getElementById('siteBackgroundRemoveBtn');
    const siteBackgroundPreview = document.getElementById('siteBackgroundPreview');
    const siteBackgroundPlaceholder = document.getElementById('siteBackgroundPlaceholder');
    
    if (siteBackgroundUploadBtn && siteBackgroundInput) {
        siteBackgroundUploadBtn.addEventListener('click', () => {
            siteBackgroundInput.click();
        });
        
        siteBackgroundInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !currentUser) return;
            
            if (file.size > 5 * 1024 * 1024) {
                showStatus('siteBackgroundStatus', 'File size must be less than 5MB', true);
                return;
            }
            
            if (!file.type.match('image/(jpeg|jpg|png)')) {
                showStatus('siteBackgroundStatus', 'Please upload a JPG or PNG image', true);
                return;
            }
            
            siteBackgroundUploadBtn.disabled = true;
            siteBackgroundUploadBtn.textContent = 'Uploading...';
            
            try {
                const imageURL = await uploadToImgBB(file);
                const userProfileRef = doc(db, 'userProfiles', currentUser.uid);
                await setDoc(userProfileRef, { 
                    siteBackgroundURL: imageURL,
                    displayName: currentUser.displayName || currentUser.email
                }, { merge: true });
                
                if (siteBackgroundPreview && siteBackgroundPlaceholder) {
                    siteBackgroundPreview.src = imageURL;
                    siteBackgroundPreview.classList.add('show');
                    siteBackgroundPreview.style.display = 'block';
                    siteBackgroundPlaceholder.classList.add('hide');
                    siteBackgroundRemoveBtn.style.display = 'block';
                }
                
                // Apply background to current page immediately
                applySiteBackground(imageURL);
                
                showStatus('siteBackgroundStatus', 'Site background updated successfully!');
                siteBackgroundInput.value = '';
            } catch (error) {
                console.error('Error uploading site background:', error);
                showStatus('siteBackgroundStatus', 'Error uploading background. Please try again.', true);
            } finally {
                siteBackgroundUploadBtn.disabled = false;
                siteBackgroundUploadBtn.textContent = 'Upload Background';
            }
        });
    }
    
    if (siteBackgroundRemoveBtn) {
        siteBackgroundRemoveBtn.addEventListener('click', async () => {
            if (!currentUser || !confirm('Are you sure you want to remove your site background?')) return;
            
            siteBackgroundRemoveBtn.disabled = true;
            siteBackgroundRemoveBtn.textContent = 'Removing...';
            
            try {
                const userProfileRef = doc(db, 'userProfiles', currentUser.uid);
                await setDoc(userProfileRef, { siteBackgroundURL: null }, { merge: true });
                
                if (siteBackgroundPreview && siteBackgroundPlaceholder) {
                    siteBackgroundPreview.classList.remove('show');
                    siteBackgroundPreview.style.display = 'none';
                    siteBackgroundPlaceholder.classList.remove('hide');
                    siteBackgroundRemoveBtn.style.display = 'none';
                }
                
                // Remove background from current page
                removeSiteBackground();
                
                showStatus('siteBackgroundStatus', 'Site background removed successfully!');
            } catch (error) {
                console.error('Error removing site background:', error);
                showStatus('siteBackgroundStatus', 'Error removing background. Please try again.', true);
            } finally {
                siteBackgroundRemoveBtn.disabled = false;
                siteBackgroundRemoveBtn.textContent = 'Remove';
            }
        });
    }
    
    // Color Theme Selection
    const colorThemeBtn = document.getElementById('colorThemeBtn');
    const colorThemeSelect = document.getElementById('colorThemeSelect');
    
    if (colorThemeBtn && colorThemeSelect) {
        colorThemeBtn.addEventListener('click', async () => {
            if (!currentUser) return;
            
            const selectedTheme = colorThemeSelect.value;
            colorThemeBtn.disabled = true;
            colorThemeBtn.textContent = 'Applying...';
            
            try {
                const userProfileRef = doc(db, 'userProfiles', currentUser.uid);
                await setDoc(userProfileRef, { colorTheme: selectedTheme }, { merge: true });
                
                // Apply theme immediately to current page
                applyColorTheme(selectedTheme);
                
                showStatus('colorThemeStatus', 'Color theme updated successfully!');
            } catch (error) {
                console.error('Error updating color theme:', error);
                showStatus('colorThemeStatus', 'Error updating theme. Please try again.', true);
            } finally {
                colorThemeBtn.disabled = false;
                colorThemeBtn.textContent = 'Apply Theme';
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    
    // Ensure banner is visible on page load (before profile loads)
    const bannerEl = document.getElementById('profileBanner');
    if (bannerEl) {
        bannerEl.style.display = 'block';
        // Set default gradient if no image yet
        if (!bannerEl.style.backgroundImage || bannerEl.style.backgroundImage === 'none') {
            bannerEl.style.backgroundImage = 'linear-gradient(135deg, rgba(76, 175, 80, 0.3), rgba(69, 160, 73, 0.3))';
        }
    }
    
    loadProfile();
    initProfileSettings();
    initGraph();
    initMessageBoard();
    
    // Additional safeguard: Monitor and prevent banner from being hidden
    if (bannerEl) {
        // Use MutationObserver to detect if display is changed to none
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const currentDisplay = bannerEl.style.display;
                    if (currentDisplay === 'none' || currentDisplay === '' && getComputedStyle(bannerEl).display === 'none') {
                        // Force it to be visible
                        bannerEl.style.display = 'block';
                    }
                }
            });
        });
        
        observer.observe(bannerEl, {
            attributes: true,
            attributeFilter: ['style']
        });
    }
});

// Graph functionality
let profileChart = null;

function initGraph() {
    const graphModeSelect = document.getElementById('graphModeSelect');
    if (graphModeSelect) {
        graphModeSelect.addEventListener('change', () => {
            updateGraph();
        });
        // Load initial graph data
        updateGraph();
    }
}

function updateGraph() {
    const graphModeSelect = document.getElementById('graphModeSelect');
    if (!graphModeSelect) return;
    
    const selectedMode = graphModeSelect.value;
    loadGraphData(selectedMode);
}

async function loadGraphData(mode) {
    const urlParams = new URLSearchParams(window.location.search);
    const playerName = urlParams.get('player');
    if (!playerName) return;
    
    const canvas = document.getElementById('profileChart');
    if (!canvas) return;
    
    try {
        // Get all scores for this mode
        const db = getFirestore();
        let scoresRef;
        
        switch(mode) {
            case 'easy':
                scoresRef = collection(db, 'easyScores');
                break;
            case 'normal':
                scoresRef = collection(db, 'normalScores');
                break;
            case 'master':
                scoresRef = collection(db, 'masterScores');
                break;
            case 'race':
                scoresRef = collection(db, 'raceScores');
                break;
            case 'hell':
                scoresRef = collection(db, 'hellScores');
                break;
            default:
                return;
        }
        
        const scoresSnapshot = await getDocs(scoresRef);
        const allScores = scoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Get user profile to check for previous usernames
        const userProfilesRef = collection(db, 'userProfiles');
        const userProfilesSnapshot = await getDocs(userProfilesRef);
        const allPlayerNames = new Set([playerName]);
        
        userProfilesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.displayName === playerName || 
                (playerName.includes('@') && data.email === playerName)) {
                allPlayerNames.add(data.displayName);
                if (data.email) allPlayerNames.add(data.email);
                if (data.previousUsernames && Array.isArray(data.previousUsernames)) {
                    data.previousUsernames.forEach(name => {
                        if (name) allPlayerNames.add(name);
                    });
                }
            } else if (data.previousUsernames && Array.isArray(data.previousUsernames) && data.previousUsernames.includes(playerName)) {
                allPlayerNames.add(data.displayName);
                if (data.email) allPlayerNames.add(data.email);
                data.previousUsernames.forEach(name => {
                    if (name) allPlayerNames.add(name);
                });
            }
        });
        
        // Filter scores for this player
        const playerScores = allScores.filter(s => allPlayerNames.has(s.name));
        
        // Sort by date
        playerScores.sort((a, b) => {
            let dateA = new Date(0);
            let dateB = new Date(0);
            
            if (a.date) {
                if (a.date.toDate && typeof a.date.toDate === 'function') {
                    dateA = a.date.toDate();
                } else if (a.date instanceof Date) {
                    dateA = a.date;
                } else {
                    dateA = new Date(a.date);
                }
            }
            
            if (b.date) {
                if (b.date.toDate && typeof b.date.toDate === 'function') {
                    dateB = b.date.toDate();
                } else if (b.date instanceof Date) {
                    dateB = b.date;
                } else {
                    dateB = new Date(b.date);
                }
            }
            
            return dateA - dateB;
        });
        
        // Prepare data for chart
        const dates = playerScores.map(s => {
            if (s.date) {
                // Handle both Firestore Timestamp and string dates
                let date;
                if (s.date.toDate && typeof s.date.toDate === 'function') {
                    date = s.date.toDate();
                } else if (s.date instanceof Date) {
                    date = s.date;
                } else {
                    date = new Date(s.date);
                }
                return date.toLocaleDateString();
            }
            return 'Unknown';
        });
        
        const scores = playerScores.map(s => {
            // Ensure score is a number
            const score = s.score;
            if (typeof score === 'number') {
                return score;
            }
            if (typeof score === 'string') {
                const parsed = parseFloat(score);
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        });
        
        // Handle empty data case
        if (dates.length === 0 || scores.length === 0 || dates.length !== scores.length) {
            // Destroy existing chart if it exists
            if (profileChart) {
                profileChart.destroy();
                profileChart = null;
            }
            // Show empty chart with message
            const ctx = canvas.getContext('2d');
            profileChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['No data available'],
                    datasets: [{
                        label: 'Score',
                        data: [0],
                        borderColor: '#dbffff',
                        backgroundColor: 'rgba(219, 255, 255, 0.1)',
                        borderWidth: 2,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 2,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    scales: {
                        x: { 
                            display: true,
                            ticks: { color: '#dbffff' },
                            grid: { color: 'rgba(219, 255, 255, 0.1)' }
                        },
                        y: { 
                            display: true,
                            ticks: { color: '#dbffff' },
                            grid: { color: 'rgba(219, 255, 255, 0.1)' }
                        }
                    }
                }
            });
            return;
        }
        
        // Chart colors based on mode
        const modeColors = {
            easy: '#90ee90',
            normal: '#87ceeb',
            master: '#fffafa',
            race: '#ff8c42',
            hell: '#ffbaba'
        };
        
        const color = modeColors[mode] || '#dbffff';
        
        // Destroy existing chart if it exists
        if (profileChart) {
            profileChart.destroy();
        }
        
        // Create new chart
        const ctx = canvas.getContext('2d');
        profileChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Score',
                    data: scores,
                    borderColor: color,
                    backgroundColor: color + '40',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: color,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: color,
                        bodyColor: '#fff',
                        borderColor: color,
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#dbffff',
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: {
                            color: 'rgba(219, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#dbffff'
                        },
                        grid: {
                            color: 'rgba(219, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading graph data:', error);
    }
}

// Message board functionality
async function initMessageBoard() {
    const newMessageBtn = document.getElementById('newMessageBtn');
    const postMessageBtn = document.getElementById('postMessageBtn');
    const cancelMessageBtn = document.getElementById('cancelMessageBtn');
    const messageBoardForm = document.getElementById('messageBoardForm');
    const messageBoardTextarea = document.getElementById('messageBoardTextarea');
    
    // Check if user is viewing their own profile
    onAuthStateChanged(auth, async (user) => {
        const urlParams = new URLSearchParams(window.location.search);
        const playerName = urlParams.get('player');
        
        if (user && playerName) {
            // Get current user's display name
            const db = getFirestore();
            const userProfilesRef = collection(db, 'userProfiles');
            const userProfilesSnapshot = await getDocs(userProfilesRef);
            let currentUserDisplayName = user.displayName || user.email;
            
            userProfilesSnapshot.forEach(doc => {
                const data = doc.data();
                if (doc.id === user.uid) {
                    currentUserDisplayName = data.displayName || data.email || currentUserDisplayName;
                }
            });
            
            // Check if viewing own profile
            const isOwnProfile = currentUserDisplayName === playerName || 
                                 (playerName.includes('@') && user.email === playerName);
            
            if (isOwnProfile && newMessageBtn) {
                newMessageBtn.style.display = 'block';
            }
        }
        
        // Load messages
        await loadMessages();
    });
    
    if (newMessageBtn) {
        newMessageBtn.addEventListener('click', () => {
            if (messageBoardForm) {
                messageBoardForm.style.display = 'block';
                if (messageBoardTextarea) {
                    messageBoardTextarea.focus();
                }
            }
        });
    }
    
    if (cancelMessageBtn) {
        cancelMessageBtn.addEventListener('click', () => {
            if (messageBoardForm) {
                messageBoardForm.style.display = 'none';
                if (messageBoardTextarea) {
                    messageBoardTextarea.value = '';
                }
            }
        });
    }
    
    if (postMessageBtn) {
        postMessageBtn.addEventListener('click', async () => {
            await postMessage();
        });
    }
}

async function loadMessages() {
    const urlParams = new URLSearchParams(window.location.search);
    const playerName = urlParams.get('player');
    if (!playerName) return;
    
    const messagesContainer = document.getElementById('messageBoardMessages');
    if (!messagesContainer) return;
    
    try {
        const db = getFirestore();
        const messagesRef = collection(db, 'profileMessages');
        const messagesSnapshot = await getDocs(messagesRef);
        
        // Filter messages for this player
        const playerMessages = [];
        messagesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.profilePlayerName === playerName) {
                playerMessages.push({ id: doc.id, ...data });
            }
        });
        
        // Sort by timestamp (newest first)
        playerMessages.sort((a, b) => {
            const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
            const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
            return timeB - timeA;
        });
        
        // Display messages
        if (playerMessages.length === 0) {
            messagesContainer.innerHTML = '<p class="message-board-empty">No messages yet. Be the first to post!</p>';
        } else {
            messagesContainer.innerHTML = playerMessages.map(msg => {
                const timestamp = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp || Date.now());
                const timeStr = formatRelativeTime(timestamp);
                return `
                    <div class="message-board-message">
                        <div class="message-board-message-header">
                            <span class="message-board-author">${msg.authorName || 'Anonymous'}</span>
                            <span class="message-board-time">${timeStr}</span>
                        </div>
                        <div class="message-board-content">${msg.content || ''}</div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        if (messagesContainer) {
            messagesContainer.innerHTML = '<p class="message-board-error">Error loading messages.</p>';
        }
    }
}

async function postMessage() {
    const urlParams = new URLSearchParams(window.location.search);
    const playerName = urlParams.get('player');
    if (!playerName) return;
    
    const messageBoardTextarea = document.getElementById('messageBoardTextarea');
    const messageBoardForm = document.getElementById('messageBoardForm');
    const messageBoardStatus = document.getElementById('messageBoardStatus');
    
    if (!messageBoardTextarea) return;
    
    const content = messageBoardTextarea.value.trim();
    if (!content) {
        showStatus('messageBoardStatus', 'Please enter a message.', true);
        return;
    }
    
    if (content.length > 500) {
        showStatus('messageBoardStatus', 'Message is too long (max 500 characters).', true);
        return;
    }
    
    try {
        const user = auth.currentUser;
        if (!user) {
            showStatus('messageBoardStatus', 'You must be logged in to post messages.', true);
            return;
        }
        
        const db = getFirestore();
        const messagesRef = collection(db, 'profileMessages');
        
        // Get user's display name
        const userProfilesRef = collection(db, 'userProfiles');
        const userProfilesSnapshot = await getDocs(userProfilesRef);
        let authorName = user.displayName || user.email;
        
        userProfilesSnapshot.forEach(doc => {
            const data = doc.data();
            if (doc.id === user.uid) {
                authorName = data.displayName || data.email || authorName;
            }
        });
        
        await setDoc(doc(messagesRef), {
            profilePlayerName: playerName,
            authorId: user.uid,
            authorName: authorName,
            content: content,
            timestamp: new Date()
        });
        
        messageBoardTextarea.value = '';
        if (messageBoardForm) {
            messageBoardForm.style.display = 'none';
        }
        
        showStatus('messageBoardStatus', 'Message posted successfully!', false);
        
        // Reload messages
        await loadMessages();
    } catch (error) {
        console.error('Error posting message:', error);
        showStatus('messageBoardStatus', 'Error posting message. Please try again.', true);
    }
}

