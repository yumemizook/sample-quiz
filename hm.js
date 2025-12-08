import { getAuth, onAuthStateChanged, signOut } from "./firebase.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc } from "./firebase.js";
import { calculatePlayerLevel } from "./stats.js";

const auth = getAuth();
let selectedMode = "normal"; // Default mode
let hasCompletedHell = false; // Track if user has completed hell mode
let hellClickCount = 0; // Track clicks on hell mode card
let hellClickTimeout = null; // Timeout to reset click counter
let secretClickCount = 0; // Track clicks on secret mode card
let secretClickTimeout = null; // Timeout to reset click counter
let isSecretModeVisible = false; // Track if secret mode is currently visible
let hasCompletedMaster = false; // Track if user has completed master mode
let masterClickCount = 0; // Track clicks on master mode card
let masterClickTimeout = null; // Timeout to reset click counter
let isRaceModeVisible = false; // Track if race mode is currently visible

// Calculate main input method based on play counts
function calculateMainInputMethod(easyScores, normalScores, masterScores, hellScores, secretScores, raceScores = []) {
    const inputCounts = {
        keyboard: 0,
        controller: 0,
        mobile: 0,
        unknown: 0
    };
    
    // Count input types across all modes
    const allScores = [...easyScores, ...normalScores, ...masterScores, ...hellScores, ...secretScores, ...raceScores];
    allScores.forEach(score => {
        const inputType = (score.inputType || "unknown").toLowerCase();
        if (inputType === "keyboard" || inputType === "⌨️") {
            inputCounts.keyboard++;
        } else if (inputType === "controller" || inputType === "🎮") {
            inputCounts.controller++;
        } else if (inputType === "mobile" || inputType === "📱") {
            inputCounts.mobile++;
        } else {
            inputCounts.unknown++;
        }
    });
    
    // Determine main input method (highest count)
    let mainInput = "unknown";
    let maxCount = inputCounts.unknown;
    
    if (inputCounts.keyboard > maxCount) {
        mainInput = "keyboard";
        maxCount = inputCounts.keyboard;
    }
    if (inputCounts.controller > maxCount) {
        mainInput = "controller";
        maxCount = inputCounts.controller;
    }
    if (inputCounts.mobile > maxCount) {
        mainInput = "mobile";
        maxCount = inputCounts.mobile;
    }
    
    // Format with icon
    const icons = {
        keyboard: "⌨️",
        controller: "🎮",
        mobile: "📱",
        unknown: "❓"
    };
    
    const names = {
        keyboard: "Keyboard",
        controller: "Controller",
        mobile: "Mobile",
        unknown: "Unknown"
    };
    
    return {
        method: mainInput,
        icon: icons[mainInput],
        name: names[mainInput],
        count: maxCount,
        total: allScores.length
    };
}

// Calculate player level and XP based on achievements and grade points
// calculatePlayerLevel is now imported from stats.js to ensure synchronization
// The function has been removed from here to use the shared version

// Get badge based on level (extended to level 1000)
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

// Get badge name/title based on level
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

// Get color class based on level for styling
function getLevelColorClass(level) {
    if (level >= 1000) return "level-meteor";
    if (level >= 900) return "level-moon";
    if (level >= 800) return "level-sun";
    if (level >= 700) return "level-earth";
    if (level >= 600) return "level-planet";
    if (level >= 500) return "level-star-high";
    if (level >= 400) return "level-glowing";
    if (level >= 300) return "level-dizzy";
    if (level >= 250) return "level-galaxy";
    if (level >= 200) return "level-shooting";
    if (level >= 150) return "level-atomic";
    if (level >= 120) return "level-crystal";
    if (level >= 100) return "level-sparkle";
    if (level >= 80) return "level-champion";
    if (level >= 70) return "level-royal";
    if (level >= 60) return "level-diamond";
    if (level >= 50) return "level-star";
    if (level >= 40) return "level-fire";
    if (level >= 35) return "level-lightning";
    if (level >= 30) return "level-shining";
    if (level >= 25) return "level-target";
    if (level >= 20) return "level-medal";
    if (level >= 15) return "level-trophy";
    if (level >= 12) return "level-gold";
    if (level >= 9) return "level-silver";
    if (level >= 6) return "level-bronze";
    if (level >= 3) return "level-star-low";
    return "level-sprout";
}

document.addEventListener("DOMContentLoaded", () => {
    // Check player achievements and calculate level
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const db = getFirestore();
                const uid = user.uid;
                
                // Fetch all mode scores
                let secretSnap = { empty: true, docs: [] };
                try {
                    secretSnap = await getDocs(collection(db, "playerData", uid, "secret"));
                } catch (e) {
                    // Secret collection might not exist yet
                    secretSnap = { empty: true, docs: [] };
                }
                
                const [easySnap, normalSnap, masterSnap, hellSnap, raceSnap] = await Promise.all([
                    getDocs(collection(db, "playerData", uid, "easy")),
                    getDocs(collection(db, "playerData", uid, "normal")),
                    getDocs(collection(db, "playerData", uid, "master")),
                    getDocs(collection(db, "playerData", uid, "hell")),
                    getDocs(collection(db, "playerData", uid, "race"))
                ]);
                
                const easyScores = easySnap.empty ? [] : easySnap.docs.map(doc => doc.data());
                const normalScores = normalSnap.empty ? [] : normalSnap.docs.map(doc => doc.data());
                const masterScores = masterSnap.empty ? [] : masterSnap.docs.map(doc => doc.data());
                const hellScores = hellSnap.empty ? [] : hellSnap.docs.map(doc => doc.data());
                const secretScores = secretSnap.empty ? [] : secretSnap.docs.map(doc => doc.data());
                const raceScores = raceSnap.empty ? [] : raceSnap.docs.map(doc => doc.data());
                
                // Check hell mode completion
                hasCompletedHell = hellScores.some(score => score.score === 200);
                
                // Master mode completion check removed - race mode is now always accessible
                // Keep the variable for toggle functionality
                hasCompletedMaster = true; // Always allow toggle between master and race mode
                
                // Calculate total plays
                const totalPlays = easyScores.length + normalScores.length + masterScores.length + hellScores.length + secretScores.length + raceScores.length;
                
                // Calculate main input method
                const mainInput = calculateMainInputMethod(easyScores, normalScores, masterScores, hellScores, secretScores, raceScores);
                
                // Calculate and display player level
                const playerData = calculatePlayerLevel(easyScores, normalScores, masterScores, hellScores, secretScores, raceScores);
                const levelDisplay = document.getElementById("playerLevel");
                const playerInfo = document.getElementById("playerInfo");
                if (levelDisplay && playerInfo) {
                    const badge = getBadgeForLevel(playerData.level);
                    const badgeName = getBadgeName(playerData.level);
                    levelDisplay.innerHTML = `<span class="level-badge" title="${badgeName}">${badge}</span> <span class="level-text">Lv. ${playerData.level}</span>`;
                    // Create tooltip element with larger badge name
                    let tooltip = levelDisplay.querySelector(".player-level-tooltip");
                    if (!tooltip) {
                        tooltip = document.createElement("div");
                        tooltip.className = "player-level-tooltip";
                        levelDisplay.appendChild(tooltip);
                    }
                    tooltip.innerHTML = `
                        <div class="tooltip-badge-name">${badgeName}</div>
                        <div class="tooltip-stats">Total XP: ${playerData.experience.toLocaleString()}<br>Total Plays: ${totalPlays.toLocaleString()}<br>Main Input: ${mainInput.icon} ${mainInput.name}</div>
                    `;
                    // Store formatted data for hover tooltip (for fallback CSS ::before)
                    levelDisplay.setAttribute("data-badge", badgeName);
                    levelDisplay.setAttribute("data-xp", playerData.experience.toLocaleString());
                    levelDisplay.setAttribute("data-plays", totalPlays.toLocaleString());
                    // Add color class based on level to playerInfo for background color
                    const colorClass = getLevelColorClass(playerData.level);
                    playerInfo.className = `player-info ${colorClass}`;
                    levelDisplay.className = `player-level`;
                    levelDisplay.classList.remove("hide");
                }
            } catch (error) {
                console.error("Error checking player achievements:", error);
            }
        } else {
            // Hide level display when logged out
            const levelDisplay = document.getElementById("playerLevel");
            const playerInfo = document.getElementById("playerInfo");
            if (levelDisplay) {
                levelDisplay.classList.add("hide");
            }
            if (playerInfo) {
                // Remove color class when logged out
                playerInfo.className = "player-info hide";
            }
        }
    });
    const displayNameContainer = document.querySelector(".name");
    
    // Handle authentication state
    onAuthStateChanged(auth, async (user) => {
        const playerInfo = document.getElementById("playerInfo");
        const playerAvatar = document.getElementById("playerAvatar");
        
        if (user && displayNameContainer && playerInfo) {
            const nameSpan = playerInfo.querySelector(".name");
            if (nameSpan) {
                nameSpan.textContent = user.displayName || user.email || "-no credentials-disabled account-";
            }
            
            playerInfo.classList.remove("hide");
            displayNameContainer.classList.remove("hide");
            document.querySelector("[login]")?.classList.add("hide");
            document.querySelector("[signup]")?.classList.add("hide");
            document.querySelector("[logout]")?.classList.remove("hide");
            
            // Make playerInfo clickable to redirect to profile page
            if (playerInfo) {
                playerInfo.style.cursor = 'pointer';
                const playerName = user.displayName || user.email || "-no credentials-disabled account-";
                playerInfo.onclick = () => {
                    window.location.href = `profile.html?player=${encodeURIComponent(playerName)}`;
                };
            }
            
            
            // Sync Firebase Auth data to userProfiles (for ranking screen avatar display)
            try {
                const db = getFirestore();
                const userProfileRef = doc(db, 'userProfiles', user.uid);
                // Sync photoURL, displayName, and email from Firebase Auth
                await setDoc(userProfileRef, {
                    displayName: user.displayName || user.email,
                    email: user.email,
                    photoURL: user.photoURL || null
                }, { merge: true });
            } catch (error) {
                console.error('Error syncing user profile:', error);
            }
            
            // Load and display avatar and banner
            try {
                const db = getFirestore();
                const userProfileRef = doc(db, 'userProfiles', user.uid);
                const userProfileSnap = await getDoc(userProfileRef);
                
                // Load avatar
                if (playerAvatar) {
                    const avatarImg = playerAvatar.querySelector("#playerAvatarImg");
                    const avatarPlaceholder = playerAvatar.querySelector(".player-avatar-placeholder");
                    
                    let avatarURL = null;
                    if (userProfileSnap.exists() && userProfileSnap.data().avatarURL) {
                        avatarURL = userProfileSnap.data().avatarURL;
                    } else if (user.photoURL) {
                        avatarURL = user.photoURL;
                    }
                    
                    if (avatarURL && avatarImg && avatarPlaceholder) {
                        // Set up image loading with error handling
                        avatarImg.onload = () => {
                            avatarImg.classList.add("show");
                            avatarPlaceholder.classList.add("hide");
                        };
                        avatarImg.onerror = () => {
                            // If image fails to load, show placeholder
                            avatarImg.classList.remove("show");
                            avatarPlaceholder.classList.remove("hide");
                        };
                        avatarImg.src = avatarURL;
                    } else if (avatarPlaceholder) {
                        if (avatarImg) {
                            avatarImg.classList.remove("show");
                            avatarImg.src = "";
                        }
                        avatarPlaceholder.classList.remove("hide");
                    }
                    playerAvatar.classList.remove("hide");
                }
                
                // Load and display profile banner (only on index.html)
                const profileBanner = document.getElementById('profileBanner');
                const bannerImage = document.getElementById('bannerImage');
                
                // Only handle banner on index.html (which has bannerImage element)
                // Don't touch profile page banner (profile.html uses profileBanner differently)
                if (bannerImage) {
                    if (userProfileSnap.exists() && userProfileSnap.data().bannerURL && profileBanner) {
                        bannerImage.src = userProfileSnap.data().bannerURL;
                        profileBanner.style.display = 'block';
                    } else if (profileBanner) {
                        profileBanner.style.display = 'none';
                    }
                }
            } catch (error) {
                console.error('Error loading profile data:', error);
            }
        } else {
            // User logged out - remove custom background
            const gameplayPages = ['master.html', 'easy.html', 'normal.html', 'hell.html', 'master130.html', 'secret.html'];
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            
            if (!gameplayPages.includes(currentPage)) {
                document.body.style.backgroundImage = '';
                document.body.style.backgroundSize = '';
                document.body.style.backgroundPosition = '';
                document.body.style.backgroundRepeat = '';
                document.body.style.backgroundAttachment = '';
            }
            
            // Hide player info when logged out
            if (playerInfo) {
                playerInfo.classList.add("hide");
            }
            if (playerAvatar) {
                playerAvatar.classList.add("hide");
            }
            if (displayNameContainer) {
                displayNameContainer.classList.add("hide");
            }
            
            // Hide level when logged out
            const levelDisplay = document.getElementById("playerLevel");
            if (levelDisplay) {
                levelDisplay.classList.add("hide");
            }
            
            // Hide banner when logged out (only on index.html, not profile page)
            const profileBanner = document.getElementById('profileBanner');
            const bannerImage = document.getElementById('bannerImage');
            // Only hide banner if we're on index.html (has bannerImage), not profile.html
            if (profileBanner && bannerImage) {
                profileBanner.style.display = 'none';
            }
        }
    });

    // Handle logout
    const logoutBtn = document.querySelector("[logout]");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            signOut(auth).then(() => {
                if (displayNameContainer) {
                    displayNameContainer.textContent = "";
                    displayNameContainer.classList.add("hide");
                }
                document.querySelector("[login]")?.classList.remove("hide");
                document.querySelector("[signup]")?.classList.remove("hide");
                document.querySelector("[logout]")?.classList.add("hide");
            }).catch((error) => {
                console.error("Error signing out:", error);
                alert("An error occurred while signing out. Please try again.");
            });
        });
    }

    // Initialize mode selection with cards
    const modeCards = document.querySelectorAll(".mode-card");
    
    // Master mode completion check removed - race mode is now always accessible
    hasCompletedMaster = true; // Always allow toggle between master and race mode
    
    // Initialize race mode visibility - hide race mode by default
    const raceCard = document.getElementById("raceModeCard");
    const masterCard = document.getElementById("masterModeCard");
    if (raceCard) {
        // Race mode starts hidden - will be shown when toggled
        raceCard.classList.add("hide");
    }
    
    // Function to update background and styling based on mode
    function updateModeStyling(mode) {
        // Remove all mode classes from body
        document.body.classList.remove("mode-easy", "mode-normal", "mode-master", "mode-hell", "mode-secret", "mode-master130");
        // Add the appropriate mode class
        document.body.classList.add(`mode-${mode}`);
    }
    
    // Set initial active state and styling
    modeCards.forEach(card => {
        if (card.dataset.mode === selectedMode) {
            card.classList.add("active");
            updateModeStyling(selectedMode);
        }
        
        card.addEventListener("click", (e) => {
            // Helper function to toggle between master and race mode
            function toggleMasterRaceMode() {
                const masterCard = document.getElementById("masterModeCard");
                const raceCard = document.getElementById("raceModeCard");
                
                if (masterCard && raceCard) {
                    isRaceModeVisible = !isRaceModeVisible;
                    
                    if (isRaceModeVisible) {
                        // Show race mode, hide master mode
                        masterCard.classList.add("hide");
                        raceCard.classList.remove("hide");
                        // Auto-select race mode
                        modeCards.forEach(c => c.classList.remove("active"));
                        raceCard.classList.add("active");
                        selectedMode = "master130";
                        updateModeStyling("master130");
                    } else {
                        // Show master mode, hide race mode
                        masterCard.classList.remove("hide");
                        raceCard.classList.add("hide");
                        // Auto-select master mode
                        modeCards.forEach(c => c.classList.remove("active"));
                        masterCard.classList.add("active");
                        selectedMode = "master";
                        updateModeStyling("master");
                    }
                    
                    // Sync navigation focus - get all visible cards
                    const visibleCards = Array.from(modeCards).filter(c => !c.classList.contains("hide"));
                    const activeCard = isRaceModeVisible ? raceCard : masterCard;
                    const cardIndex = visibleCards.indexOf(activeCard);
                    if (cardIndex !== -1) {
                        import("./menuNavigation.js").then(module => {
                            if (module.syncModeSelection) {
                                module.syncModeSelection(cardIndex);
                            }
                        }).catch(() => {});
                    }
                }
            }
            
            // Helper function to toggle between hell and secret mode
            function toggleHellSecretMode() {
                const hellCard = document.querySelector('[data-mode="hell"]');
                const secretCard = document.getElementById("secretModeCard");
                
                if (hellCard && secretCard) {
                    isSecretModeVisible = !isSecretModeVisible;
                    
                    if (isSecretModeVisible) {
                        // Show secret mode, hide hell mode
                        hellCard.classList.add("hide");
                        secretCard.classList.remove("hide");
                        // Auto-select secret mode
                        modeCards.forEach(c => c.classList.remove("active"));
                        secretCard.classList.add("active");
                        selectedMode = "secret";
                        updateModeStyling("secret");
                    } else {
                        // Show hell mode, hide secret mode
                        hellCard.classList.remove("hide");
                        secretCard.classList.add("hide");
                        // Auto-select hell mode
                        modeCards.forEach(c => c.classList.remove("active"));
                        hellCard.classList.add("active");
                        selectedMode = "hell";
                        updateModeStyling("hell");
                    }
                    
                    // Sync navigation focus - get all visible cards
                    const visibleCards = Array.from(modeCards).filter(c => !c.classList.contains("hide"));
                    const activeCard = isSecretModeVisible ? secretCard : hellCard;
                    const cardIndex = visibleCards.indexOf(activeCard);
                    if (cardIndex !== -1) {
                        import("./menuNavigation.js").then(module => {
                            if (module.syncModeSelection) {
                                module.syncModeSelection(cardIndex);
                            }
                        }).catch(() => {});
                    }
                }
            }
            
            // Special handling for hell mode card - 5 clicks to toggle secret mode
            if (card.dataset.mode === "hell" && hasCompletedHell) {
                hellClickCount++;
                
                // Clear existing timeout
                if (hellClickTimeout) {
                    clearTimeout(hellClickTimeout);
                }
                
                // Reset counter after 2 seconds of no clicks
                hellClickTimeout = setTimeout(() => {
                    hellClickCount = 0;
                }, 2000);
                
                // If clicked 5 times, toggle between hell and secret mode
                if (hellClickCount >= 5) {
                    e.stopPropagation(); // Prevent normal click handling
                    hellClickCount = 0;
                    clearTimeout(hellClickTimeout);
                    toggleHellSecretMode();
                    return; // Don't process as normal click
                }
            }
            
            // Special handling for secret mode card - 5 clicks to toggle back to hell mode
            if (card.dataset.mode === "secret" && hasCompletedHell) {
                secretClickCount++;
                
                // Clear existing timeout
                if (secretClickTimeout) {
                    clearTimeout(secretClickTimeout);
                }
                
                // Reset counter after 2 seconds of no clicks
                secretClickTimeout = setTimeout(() => {
                    secretClickCount = 0;
                }, 2000);
                
                // If clicked 5 times, toggle back to hell mode
                if (secretClickCount >= 5) {
                    e.stopPropagation(); // Prevent normal click handling
                    secretClickCount = 0;
                    clearTimeout(secretClickTimeout);
                    toggleHellSecretMode();
                    return; // Don't process as normal click
                }
            }
            
            // Special handling for master mode card - 5 clicks to toggle race mode
            if (card.dataset.mode === "master") {
                masterClickCount++;
                
                // Clear existing timeout
                if (masterClickTimeout) {
                    clearTimeout(masterClickTimeout);
                }
                
                // Reset counter after 2 seconds of no clicks
                masterClickTimeout = setTimeout(() => {
                    masterClickCount = 0;
                }, 2000);
                
                // If clicked 5 times, toggle between master and race mode
                if (masterClickCount >= 5) {
                    e.stopPropagation(); // Prevent normal click handling
                    masterClickCount = 0;
                    clearTimeout(masterClickTimeout);
                    toggleMasterRaceMode();
                    return; // Don't process as normal click
                }
            }
            
            // Special handling for race mode card - 5 clicks to toggle back to master mode
            if (card.dataset.mode === "master130") {
                masterClickCount++;
                
                // Clear existing timeout
                if (masterClickTimeout) {
                    clearTimeout(masterClickTimeout);
                }
                
                // Reset counter after 2 seconds of no clicks
                masterClickTimeout = setTimeout(() => {
                    masterClickCount = 0;
                }, 2000);
                
                // If clicked 5 times, toggle back to master mode
                if (masterClickCount >= 5) {
                    e.stopPropagation(); // Prevent normal click handling
                    masterClickCount = 0;
                    clearTimeout(masterClickTimeout);
                    toggleMasterRaceMode();
                    return; // Don't process as normal click
                }
            }
            
            // Normal click handling - skip if card is hidden
            if (card.classList.contains("hide")) {
                return;
            }
            
            // Remove active class from all cards
            modeCards.forEach(c => c.classList.remove("active"));
            // Add active class to clicked card
            card.classList.add("active");
            selectedMode = card.dataset.mode;
            // Update background and styling
            updateModeStyling(selectedMode);
            
            // Sync navigation focus with clicked card
            const visibleCards = Array.from(modeCards).filter(c => !c.classList.contains("hide"));
            const cardIndex = visibleCards.indexOf(card);
            if (cardIndex !== -1) {
                // Sync navigation focus (menuNavigation.js should be loaded)
                import("./menuNavigation.js").then(module => {
                    if (module.syncModeSelection) {
                        module.syncModeSelection(cardIndex);
                    }
                }).catch(() => {
                    // Navigation module not loaded yet, ignore
                });
            }
        });
    });

    // Handle play button
    const playBtn = document.querySelector(".play-btn");
    if (playBtn) {
        playBtn.addEventListener("click", () => {
            // Get mode settings
            const livesValue = document.getElementById("lives")?.value || "unlimited";
            const timeMultiplier = parseFloat(document.getElementById("timeMultiplier")?.value || "1");
            const fadingMode = document.getElementById("fadingMode")?.value || "off";
            const startQuestion = parseInt(document.getElementById("startQuestion")?.value || "0");
            
            // Build URL parameters
            const params = new URLSearchParams();
            params.set("lives", livesValue);
            params.set("timeMultiplier", timeMultiplier.toString());
            if (fadingMode !== "off") params.set("fading", fadingMode);
            if (startQuestion > 0) params.set("start", startQuestion);
            
            const queryString = params.toString();
            const urlSuffix = queryString ? `?${queryString}` : "";
            
            if (selectedMode === "normal") {
                window.location.href = "normal.html" + urlSuffix;
            } else if (selectedMode === "master") {
                window.location.href = "master.html" + urlSuffix;
            } else if (selectedMode === "hell") {
                window.location.href = "hell.html" + urlSuffix;
            } else if (selectedMode === "easy") {
                window.location.href = "easy.html" + urlSuffix;
            } else if (selectedMode === "secret") {
                window.location.href = "secret.html" + urlSuffix;
            } else if (selectedMode === "master130") {
                window.location.href = "master130.html" + urlSuffix;
            }
        });
    }

    // Handle high scores button
    const hiscoreBtn = document.querySelector(".hiscore");
    if (hiscoreBtn) {
        hiscoreBtn.addEventListener("click", () => {
            window.location.href = "IR.html";
        });
    }

    // Handle stats button
    const statsBtn = document.querySelector(".stats");
    if (statsBtn) {
        statsBtn.addEventListener("click", () => {
            window.location.href = "stats.html";
        });
    }

    // Handle wiki button
    const wikiBtn = document.querySelector(".wiki");
    if (wikiBtn) {
        wikiBtn.addEventListener("click", () => {
            window.location.href = "wiki.html"; // Change this URL to your wiki page
        });
    }
    
});