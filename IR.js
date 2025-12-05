import { getFirestore, collection, getDocs, query, where, getDocs as getDocsQuery, doc, getDoc } from "./firebase.js";

const db = getFirestore();

// Helper function to compare line colors (orange > green > white)
// Returns: 1 if line1 > line2, -1 if line1 < line2, 0 if equal
function compareLineColors(line1, line2) {
    const lineOrder = { "orange": 3, "green": 2, "white": 1, "": 1 };
    const val1 = lineOrder[line1] || 1;
    const val2 = lineOrder[line2] || 1;
    return val1 - val2;
}
const highScoresRef = collection(db, 'scoresnormal');
const masterModeRef = collection(db, 'scoresmaster');
const easyModeRef = collection(db, 'scoreseasy');
const finalModeRef = collection(db, 'scoresfinal');

// Store raw scores data for filtering
let allEasyScores = [];
let allNormalScores = [];
let allMasterScores = [];
let allHellScores = [];

// Current filter state
const currentFilter = {
    easy: 'all',
    normal: 'all',
    master: 'all',
    hell: 'all'
};

// Tab switching functionality
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetContent = document.getElementById(`${targetTab}-tab`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// Initialize input filter buttons
function initInputFilters() {
    const filterButtons = document.querySelectorAll('.input-filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const inputType = button.getAttribute('data-input');
            const mode = button.getAttribute('data-mode');
            
            // Update active state
            document.querySelectorAll(`.input-filter-btn[data-mode="${mode}"]`).forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            
            // Update filter state
            currentFilter[mode] = inputType;
            
            // Re-render the table for this mode
            renderTable(mode);
        });
    });
}

// Filter scores by input type
function filterScores(scores, inputType) {
    if (inputType === 'all') {
        return scores;
    }
    return scores.filter(score => score.inputType === inputType);
}

// Render table for a specific mode
function renderTable(mode) {
    const filterType = currentFilter[mode];
    let scores = [];
    let tableId = '';
    let hasGrade = false;
    let sortFunction = null;
    
    switch(mode) {
        case 'easy':
            scores = filterScores(allEasyScores, filterType);
            tableId = 'scoreTable';
            hasGrade = false;
            sortFunction = (a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                return parseTime(a.time) - parseTime(b.time);
            };
            break;
        case 'normal':
            scores = filterScores(allNormalScores, filterType);
            tableId = 'scoreTable2';
            hasGrade = true;
            sortFunction = (a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                if (a.grade && b.grade && a.grade !== b.grade) {
                    const gradeComp = b.grade.localeCompare(a.grade);
                    if (gradeComp !== 0) return gradeComp;
                }
                if (a.grade && b.grade && a.grade === b.grade) {
                    const lineComp = compareLineColors(a.line || "white", b.line || "white");
                    if (lineComp !== 0) return -lineComp;
                }
                return parseTime(a.time) - parseTime(b.time);
            };
            break;
        case 'master':
            scores = filterScores(allMasterScores, filterType);
            tableId = 'scoreTable3';
            hasGrade = true;
            sortFunction = (a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                if (a.grade && b.grade && a.grade !== b.grade) {
                    const gradeOrder = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "GM", "Grand Master"];
                    const index1 = gradeOrder.indexOf(a.grade);
                    const index2 = gradeOrder.indexOf(b.grade);
                    if (index1 !== -1 && index2 !== -1) {
                        const gradeComp = index1 - index2;
                        if (gradeComp !== 0) return -gradeComp;
                    }
                }
                if (a.grade && b.grade && a.grade === b.grade) {
                    const lineComp = compareLineColors(a.line || "white", b.line || "white");
                    if (lineComp !== 0) return -lineComp;
                }
                return parseTime(a.time) - parseTime(b.time);
            };
            break;
        case 'hell':
            scores = filterScores(allHellScores, filterType);
            tableId = 'scoreTable4';
            hasGrade = true;
            sortFunction = (a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                if (a.grade && b.grade && a.grade !== b.grade) {
                    if (a.grade === "Grand Master - Infinity") return -1;
                    if (b.grade === "Grand Master - Infinity") return 1;
                    if (a.grade.startsWith("S") && b.grade.startsWith("S")) {
                        const num1 = parseInt(a.grade.substring(1)) || 0;
                        const num2 = parseInt(b.grade.substring(1)) || 0;
                        const gradeComp = num1 - num2;
                        if (gradeComp !== 0) return -gradeComp;
                    } else {
                        const gradeComp = b.grade.localeCompare(a.grade);
                        if (gradeComp !== 0) return gradeComp;
                    }
                }
                if (a.grade && b.grade && a.grade === b.grade) {
                    const lineComp = compareLineColors(a.line || "white", b.line || "white");
                    if (lineComp !== 0) return -lineComp;
                }
                return parseTime(a.time) - parseTime(b.time);
            };
            break;
    }
    
    const table = document.querySelector(`#${tableId}`);
    if (!table) return;
    
    // Clear existing rows
    const tbody = table.querySelector("tbody");
    if (tbody) {
        tbody.remove();
    }
    const newTbody = document.createElement("tbody");
    table.appendChild(newTbody);
    
    if (scores.length === 0) {
        const colspan = hasGrade ? 7 : 6;
        newTbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.7);">No scores available yet</td></tr>`;
        return;
    }
    
    // Sort scores
    const sortedScores = scores.sort(sortFunction);
    
    // Format grade helper
    const formatGrade = (grade) => {
        if (!grade || grade === "-") return "-";
        if (grade === "Grand Master - Infinity") return "GM-∞";
        return grade;
    };
    
    const getLineColor = (entry) => {
        if (!entry || !entry.line) return "#ffffff";
        const lineColor = entry.line;
        if (lineColor === "orange") return "#ff8800";
        if (lineColor === "green") return "#00ff00";
        return "#ffffff";
    };
    
    // Format input type with icon
    const formatInputType = (inputType) => {
        if (!inputType || inputType === 'unknown') return "❓";
        if (inputType === 'controller') return "🎮";
        if (inputType === 'keyboard') return "⌨️";
        if (inputType === 'mobile') return "📱";
        return "❓";
    };
    
    // Render rows
    sortedScores.forEach((scoreData, index) => {
        const rank = index + 1;
        const listItem = document.createElement("tr");
        const inputTypeDisplay = formatInputType(scoreData.inputType);
        const playerName = scoreData.name || '';
        
        if (hasGrade) {
            const gradeDisplay = scoreData.grade 
                ? `<span class="grade-badge" style="color: ${getLineColor(scoreData)}">${formatGrade(scoreData.grade)}</span>` 
                : "-";
            listItem.innerHTML = `
                <td>${rank}</td>
                <td><span class="player-name-hover" data-player-name="${playerName}">${playerName}</span></td>
                <td class="high-score">${scoreData.score}</td>
                <td>${gradeDisplay}</td>
                <td>${scoreData.time}</td>
                <td>${inputTypeDisplay}</td>
                <td>${scoreData.date}</td>
            `;
        } else {
            listItem.innerHTML = `
                <td>${rank}</td>
                <td><span class="player-name-hover" data-player-name="${playerName}">${playerName}</span></td>
                <td class="high-score">${scoreData.score}</td>
                <td>${scoreData.time}</td>
                <td>${inputTypeDisplay}</td>
                <td>${scoreData.date}</td>
            `;
        }
        newTbody.appendChild(listItem);
    });
    
    // Attach hover event listeners to player names
    attachPlayerNameHovers();
}

// Parse time string to milliseconds
function parseTime(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
}

// Profile popup functionality
let profilePopup = null;
let profilePopupTimeout = null;

// Create profile popup element
function createProfilePopup() {
    if (profilePopup) return profilePopup;
    
    profilePopup = document.createElement('div');
    profilePopup.id = 'playerProfilePopup';
    profilePopup.className = 'player-profile-popup';
    profilePopup.innerHTML = `
        <div class="profile-popup-banner"></div>
        <div class="profile-popup-content">
            <div class="profile-popup-avatar-container">
                <img class="profile-popup-avatar" src="" alt="Avatar">
                <div class="profile-popup-avatar-placeholder">👤</div>
            </div>
            <div class="profile-popup-info">
                <h3 class="profile-popup-name"></h3>
                <div class="profile-popup-level">
                    <span class="profile-popup-badge"></span>
                    <span class="profile-popup-level-text"></span>
                </div>
            </div>
            <div class="profile-popup-scores">
                <h4>Best Scores</h4>
                <div class="profile-popup-score-item">
                    <span class="score-mode">Easy:</span>
                    <span class="score-value">-</span>
                </div>
                <div class="profile-popup-score-item">
                    <span class="score-mode">Normal:</span>
                    <span class="score-value">-</span>
                </div>
                <div class="profile-popup-score-item">
                    <span class="score-mode">Master:</span>
                    <span class="score-value">-</span>
                </div>
                <div class="profile-popup-score-item">
                    <span class="score-mode">Hell:</span>
                    <span class="score-value">-</span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(profilePopup);
    return profilePopup;
}

// Get badge emoji and name (matching hm.js logic)
function getBadgeForLevel(level) {
    if (level >= 1000) return "🌠"; // Meteor (Lv 1000+)
    if (level >= 900) return "🌙"; // Moon (Lv 900-999)
    if (level >= 800) return "☀️"; // Sun (Lv 800-899)
    if (level >= 700) return "🌍"; // Earth (Lv 700-799)
    if (level >= 600) return "🪐"; // Planet (Lv 600-699)
    if (level >= 500) return "⭐"; // Star (Lv 500-599)
    if (level >= 400) return "🌟"; // Glowing Star (Lv 400-499)
    if (level >= 300) return "💫"; // Dizzy Star (Lv 300-399)
    if (level >= 250) return "🌌"; // Galaxy (Lv 250-299)
    if (level >= 200) return "🌠"; // Shooting Star (Lv 200-249)
    if (level >= 150) return "⚛️"; // Atomic (Lv 150-199)
    if (level >= 120) return "🔮"; // Crystal (Lv 120-149)
    if (level >= 100) return "✨"; // Sparkle (Lv 100-119)
    if (level >= 80) return "🏆"; // Champion (Lv 80-99)
    if (level >= 70) return "👑"; // Royal (Lv 70-79)
    if (level >= 60) return "💎"; // Diamond (Lv 60-69)
    if (level >= 50) return "⭐"; // Star (Lv 50-59)
    if (level >= 40) return "🔥"; // Fire (Lv 40-49)
    if (level >= 35) return "⚡"; // Lightning (Lv 35-39)
    if (level >= 30) return "🌟"; // Shining Star (Lv 30-34)
    if (level >= 25) return "🎯"; // Target (Lv 25-29)
    if (level >= 20) return "🎖️"; // Medal (Lv 20-24)
    if (level >= 15) return "🏅"; // Trophy (Lv 15-19)
    if (level >= 12) return "🥇"; // Gold Medal (Lv 12-14)
    if (level >= 9) return "🥈"; // Silver Medal (Lv 9-11)
    if (level >= 6) return "🥉"; // Bronze Medal (Lv 6-8)
    if (level >= 3) return "⭐"; // Star (Lv 3-5)
    return "🌱"; // Sprout (Lv 1-2)
}

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
    if (level >= 25) return "Target";
    if (level >= 20) return "Medal";
    if (level >= 15) return "Trophy";
    if (level >= 12) return "Gold Medal";
    if (level >= 9) return "Silver Medal";
    if (level >= 6) return "Bronze Medal";
    if (level >= 3) return "Star";
    return "Sprout";
}

// Calculate player level from scores (simplified version)
function calculatePlayerLevelFromScores(easyScores, normalScores, masterScores, hellScores) {
    let experience = 0;
    
    easyScores.forEach(score => {
        const gradePoints = score.score || 0;
        experience += Math.floor(gradePoints / 100);
    });
    
    normalScores.forEach(score => {
        const correctAnswers = score.score || 0;
        experience += Math.floor(correctAnswers * 0.5);
        if (correctAnswers >= 150) experience += 25;
        else if (correctAnswers >= 100) experience += 15;
        else if (correctAnswers >= 50) experience += 10;
    });
    
    masterScores.forEach(score => {
        const gradePoints = score.score || 0;
        experience += Math.floor(gradePoints / 200);
        if (score.grade === "GM") experience += 100;
        else if (score.grade && score.grade.startsWith("S")) {
            const sLevel = parseInt(score.grade.substring(1)) || 0;
            experience += sLevel * 5;
        }
        if (score.line === "orange") experience += 50;
        else if (score.line === "green") experience += 25;
    });
    
    hellScores.forEach(score => {
        const correctAnswers = score.score || 0;
        experience += Math.floor(correctAnswers * 1.5);
        if (score.grade === "Grand Master - Infinity") experience += 200;
        else if (score.grade && score.grade.startsWith("S")) {
            const sLevel = parseInt(score.grade.substring(1)) || 0;
            experience += sLevel * 10;
        }
    });
    
    const easyCompleted = easyScores.some(s => s.score === 30);
    if (easyCompleted) experience += 25;
    
    const masterCompleted = masterScores.some(s => s.score === 90);
    if (masterCompleted) experience += 75;
    
    const hellCompleted = hellScores.some(s => s.score === 200);
    if (hellCompleted) experience += 150;
    
    const finalLevel = Math.max(1, Math.floor(1 + Math.sqrt(experience / 10)));
    return { level: finalLevel, experience: experience };
}

// Find best scores for each mode
function findBestScores(playerName) {
    const bestScores = {
        easy: null,
        normal: null,
        master: null,
        hell: null
    };
    
    // Find best easy score
    const easyPlayerScores = allEasyScores.filter(s => s.name === playerName);
    if (easyPlayerScores.length > 0) {
        easyPlayerScores.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            return parseTime(a.time) - parseTime(b.time);
        });
        bestScores.easy = easyPlayerScores[0];
    }
    
    // Find best normal score
    const normalPlayerScores = allNormalScores.filter(s => s.name === playerName);
    if (normalPlayerScores.length > 0) {
        normalPlayerScores.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            if (a.grade && b.grade && a.grade !== b.grade) {
                return b.grade.localeCompare(a.grade);
            }
            return parseTime(a.time) - parseTime(b.time);
        });
        bestScores.normal = normalPlayerScores[0];
    }
    
    // Find best master score
    const masterPlayerScores = allMasterScores.filter(s => s.name === playerName);
    if (masterPlayerScores.length > 0) {
        masterPlayerScores.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            if (a.grade && b.grade && a.grade !== b.grade) {
                const gradeOrder = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "GM", "Grand Master"];
                const index1 = gradeOrder.indexOf(a.grade);
                const index2 = gradeOrder.indexOf(b.grade);
                if (index1 !== -1 && index2 !== -1) {
                    const gradeComp = index1 - index2;
                    if (gradeComp !== 0) return -gradeComp;
                }
            }
            return parseTime(a.time) - parseTime(b.time);
        });
        bestScores.master = masterPlayerScores[0];
    }
    
    // Find best hell score
    const hellPlayerScores = allHellScores.filter(s => s.name === playerName);
    if (hellPlayerScores.length > 0) {
        hellPlayerScores.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            if (a.grade && b.grade && a.grade !== b.grade) {
                if (a.grade === "Grand Master - Infinity") return -1;
                if (b.grade === "Grand Master - Infinity") return 1;
                if (a.grade.startsWith("S") && b.grade.startsWith("S")) {
                    const num1 = parseInt(a.grade.substring(1)) || 0;
                    const num2 = parseInt(b.grade.substring(1)) || 0;
                    return num2 - num1;
                }
                return b.grade.localeCompare(a.grade);
            }
            return parseTime(a.time) - parseTime(b.time);
        });
        bestScores.hell = hellPlayerScores[0];
    }
    
    return bestScores;
}

// Load and display player profile
async function loadPlayerProfile(playerName) {
    if (!playerName) return;
    
    const popup = createProfilePopup();
    
    // Reset avatar to placeholder initially
    const avatarImg = popup.querySelector('.profile-popup-avatar');
    const avatarPlaceholder = popup.querySelector('.profile-popup-avatar-placeholder');
    avatarImg.classList.remove('show');
    avatarPlaceholder.classList.remove('hide');
    avatarImg.src = ''; // Clear any previous image
    
    // Set player name
    popup.querySelector('.profile-popup-name').textContent = playerName;
    
    // Find best scores
    const bestScores = findBestScores(playerName);
    
    // Calculate level from scores
    const easyScores = allEasyScores.filter(s => s.name === playerName);
    const normalScores = allNormalScores.filter(s => s.name === playerName);
    const masterScores = allMasterScores.filter(s => s.name === playerName);
    const hellScores = allHellScores.filter(s => s.name === playerName);
    
    const playerData = calculatePlayerLevelFromScores(easyScores, normalScores, masterScores, hellScores);
    const badge = getBadgeForLevel(playerData.level);
    const badgeName = getBadgeName(playerData.level);
    
    // Update level display
    const badgeEl = popup.querySelector('.profile-popup-badge');
    const levelTextEl = popup.querySelector('.profile-popup-level-text');
    badgeEl.textContent = badge;
    levelTextEl.textContent = `Lv. ${playerData.level} (${badgeName})`;
    
    // Update best scores
    const updateScore = (mode, scoreData) => {
        const scoreItem = popup.querySelector(`.profile-popup-score-item:nth-child(${['easy', 'normal', 'master', 'hell'].indexOf(mode) + 2})`);
        if (scoreItem) {
            const scoreValue = scoreItem.querySelector('.score-value');
            if (scoreData) {
                if (mode === 'normal' || mode === 'master' || mode === 'hell') {
                    const grade = scoreData.grade ? ` - ${scoreData.grade}` : '';
                    scoreValue.textContent = `${scoreData.score}${grade}`;
                } else {
                    scoreValue.textContent = scoreData.score;
                }
            } else {
                scoreValue.textContent = 'No score';
            }
        }
    };
    
    updateScore('easy', bestScores.easy);
    updateScore('normal', bestScores.normal);
    updateScore('master', bestScores.master);
    updateScore('hell', bestScores.hell);
    
    // Try to load avatar and banner from Firestore
    try {
        // Query userProfiles to find user by displayName or email
        const userProfilesRef = collection(db, 'userProfiles');
        const userProfilesSnapshot = await getDocs(userProfilesRef);
        
        let foundUser = null;
        const isEmail = playerName.includes('@');
        
        userProfilesSnapshot.forEach(doc => {
            const data = doc.data();
            // Check if this user's displayName or email matches
            if (data.displayName === playerName || 
                (isEmail && data.email === playerName) ||
                (isEmail && playerName === data.displayName)) {
                foundUser = { uid: doc.id, ...data };
            }
        });
        
        // If not found by displayName/email, try to find by matching the name in scores
        // The name in scores could be either displayName or email from Firebase Auth
        if (!foundUser) {
            // Try to find user by checking if playerName matches any user's email or displayName
            // by looking at the UID in userProfiles and checking if their stored email/displayName matches
            userProfilesSnapshot.forEach(doc => {
                const data = doc.data();
                // Check if playerName matches email (if stored) or displayName
                if ((data.email && data.email === playerName) || 
                    (data.displayName && data.displayName === playerName)) {
                    foundUser = { uid: doc.id, ...data };
                }
            });
        }
        
        // Load avatar - prioritize photoURL from Firebase Auth (stored in userProfiles)
        const avatarImg = popup.querySelector('.profile-popup-avatar');
        const avatarPlaceholder = popup.querySelector('.profile-popup-avatar-placeholder');
        
        if (foundUser) {
            // Get photoURL from Firebase Auth (stored in userProfiles when user signs in)
            // Priority: photoURL (from Firebase Auth) > avatarURL (custom upload)
            const avatarURL = foundUser.photoURL || foundUser.avatarURL;
            
            if (avatarURL) {
                // Set up image loading with error handling
                avatarImg.onload = () => {
                    avatarImg.classList.add('show');
                    avatarPlaceholder.classList.add('hide');
                };
                avatarImg.onerror = () => {
                    // If image fails to load, show placeholder
                    avatarImg.classList.remove('show');
                    avatarPlaceholder.classList.remove('hide');
                    avatarImg.src = ''; // Clear failed src
                };
                avatarImg.src = avatarURL;
            } else {
                avatarImg.classList.remove('show');
                avatarPlaceholder.classList.remove('hide');
                avatarImg.src = ''; // Clear src if no URL
            }
            
            // Load banner
            const bannerEl = popup.querySelector('.profile-popup-banner');
            if (foundUser.bannerURL) {
                bannerEl.style.backgroundImage = `url(${foundUser.bannerURL})`;
                bannerEl.style.display = 'block';
            } else {
                bannerEl.style.display = 'none';
            }
        } else {
            // No profile found, use defaults
            avatarImg.classList.remove('show');
            avatarPlaceholder.classList.remove('hide');
            avatarImg.src = '';
            
            const bannerEl = popup.querySelector('.profile-popup-banner');
            bannerEl.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading player profile:', error);
        // On error, show placeholder
        const avatarImg = popup.querySelector('.profile-popup-avatar');
        const avatarPlaceholder = popup.querySelector('.profile-popup-avatar-placeholder');
        avatarImg.classList.remove('show');
        avatarPlaceholder.classList.remove('hide');
    }
}

// Attach hover event listeners to player names
function attachPlayerNameHovers() {
    const playerNames = document.querySelectorAll('.player-name-hover');
    
    playerNames.forEach(nameEl => {
        const playerName = nameEl.getAttribute('data-player-name');
        
        nameEl.addEventListener('mouseenter', () => {
            if (profilePopupTimeout) {
                clearTimeout(profilePopupTimeout);
            }
            
            profilePopupTimeout = setTimeout(async () => {
                const popup = createProfilePopup();
                await loadPlayerProfile(playerName);
                popup.style.display = 'block';
                positionPopup(popup, nameEl);
            }, 300); // Small delay to prevent accidental hovers
        });
        
        nameEl.addEventListener('mouseleave', () => {
            if (profilePopupTimeout) {
                clearTimeout(profilePopupTimeout);
            }
            
            const popup = document.getElementById('playerProfilePopup');
            if (popup) {
                // Keep popup visible when hovering over it
                const handlePopupEnter = () => {
                    if (profilePopupTimeout) clearTimeout(profilePopupTimeout);
                };
                
                const handlePopupLeave = () => {
                    profilePopupTimeout = setTimeout(() => {
                        if (popup) {
                            popup.style.display = 'none';
                        }
                    }, 200);
                };
                
                // Remove old listeners and add new ones
                popup.removeEventListener('mouseenter', handlePopupEnter);
                popup.removeEventListener('mouseleave', handlePopupLeave);
                popup.addEventListener('mouseenter', handlePopupEnter);
                popup.addEventListener('mouseleave', handlePopupLeave);
                
                profilePopupTimeout = setTimeout(() => {
                    if (popup && !popup.matches(':hover')) {
                        popup.style.display = 'none';
                    }
                }, 200);
            }
        });
    });
}

// Position popup near the hovered element
function positionPopup(popup, targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // On mobile, center the popup on screen
        const left = (window.innerWidth - popupRect.width) / 2;
        const top = Math.max(10, (window.innerHeight - popupRect.height) / 2);
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    } else {
        // Desktop positioning
        let left = rect.right + 15;
        let top = rect.top;
        
        // Adjust if popup would go off screen
        if (left + popupRect.width > window.innerWidth) {
            left = rect.left - popupRect.width - 15;
        }
        
        if (top + popupRect.height > window.innerHeight) {
            top = window.innerHeight - popupRect.height - 10;
        }
        
        if (top < 10) {
            top = 10;
        }
        
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // Initialize tabs
    initTabs();
    
    // Initialize input filters
    initInputFilters();
    
    try {
        const snapshot = await getDocs(highScoresRef);
        const masterSnapshot = await getDocs(masterModeRef);
        const easySnapshot = await getDocs(easyModeRef);
        const finalSnapshot = await getDocs(finalModeRef);
        
        // Store raw scores
        allNormalScores = snapshot.empty ? [] : snapshot.docs.map((doc) => doc.data());
        allEasyScores = easySnapshot.empty ? [] : easySnapshot.docs.map((doc) => doc.data());
        allMasterScores = masterSnapshot.empty ? [] : masterSnapshot.docs.map((doc) => doc.data());
        allHellScores = finalSnapshot.empty ? [] : finalSnapshot.docs.map((doc) => doc.data());
        
        // Render all tables
        renderTable('easy');
        renderTable('normal');
        renderTable('master');
        renderTable('hell');
    } catch (error) {
        console.error("Error fetching high scores:", error);
    }
});
