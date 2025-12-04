import { getAuth, onAuthStateChanged, signOut } from "./firebase.js";
import { getFirestore, collection, getDocs } from "./firebase.js";

const auth = getAuth();
let selectedMode = "normal"; // Default mode
let hasCompletedHell = false; // Track if user has completed hell mode
let hellClickCount = 0; // Track clicks on hell mode card
let hellClickTimeout = null; // Timeout to reset click counter
let secretClickCount = 0; // Track clicks on secret mode card
let secretClickTimeout = null; // Timeout to reset click counter
let isSecretModeVisible = false; // Track if secret mode is currently visible

// Calculate player level and XP based on achievements
function calculatePlayerLevel(easyScores, normalScores, masterScores, hellScores, secretScores) {
    let level = 1;
    let experience = 0;
    
    // Easy mode completion (30 questions)
    const easyCompleted = easyScores.some(s => s.score === 30);
    if (easyCompleted) {
        experience += 10;
        level++;
    }
    
    // Normal mode - check for high scores
    if (normalScores.length > 0) {
        const bestNormal = Math.max(...normalScores.map(s => s.score || 0));
        if (bestNormal >= 50) experience += 10;
        if (bestNormal >= 100) experience += 10;
        if (bestNormal >= 150) experience += 10;
    }
    
    // Master mode completion (90 questions)
    const masterCompleted = masterScores.some(s => s.score === 90);
    if (masterCompleted) {
        experience += 20;
        level += 2;
    }
    
    // Master mode - check for GM grade
    const hasGM = masterScores.some(s => s.grade === "GM");
    if (hasGM) {
        experience += 30;
        level += 2;
    }
    
    // Hell mode completion (200 questions)
    const hellCompleted = hellScores.some(s => s.score === 200);
    if (hellCompleted) {
        experience += 50;
        level += 3;
        hasCompletedHell = true;
    }
    
    // Secret mode completion (300 questions)
    const secretCompleted = secretScores.some(s => s.score === 300);
    if (secretCompleted) {
        experience += 100;
        level += 5;
    }
    
    // Calculate final level based on total experience
    const finalLevel = Math.max(1, Math.floor(level + (experience / 50)));
    
    return { level: finalLevel, experience: experience };
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
                
                const [easySnap, normalSnap, masterSnap, hellSnap] = await Promise.all([
                    getDocs(collection(db, "playerData", uid, "easy")),
                    getDocs(collection(db, "playerData", uid, "normal")),
                    getDocs(collection(db, "playerData", uid, "master")),
                    getDocs(collection(db, "playerData", uid, "hell"))
                ]);
                
                const easyScores = easySnap.empty ? [] : easySnap.docs.map(doc => doc.data());
                const normalScores = normalSnap.empty ? [] : normalSnap.docs.map(doc => doc.data());
                const masterScores = masterSnap.empty ? [] : masterSnap.docs.map(doc => doc.data());
                const hellScores = hellSnap.empty ? [] : hellSnap.docs.map(doc => doc.data());
                const secretScores = secretSnap.empty ? [] : secretSnap.docs.map(doc => doc.data());
                
                // Check hell mode completion
                hasCompletedHell = hellScores.some(score => score.score === 200);
                
                // Calculate and display player level
                const playerData = calculatePlayerLevel(easyScores, normalScores, masterScores, hellScores, secretScores);
                const levelDisplay = document.getElementById("playerLevel");
                if (levelDisplay) {
                    levelDisplay.textContent = `Lv. ${playerData.level}`;
                    levelDisplay.classList.remove("hide");
                }
            } catch (error) {
                console.error("Error checking player achievements:", error);
            }
        } else {
            // Hide level display when logged out
            const levelDisplay = document.getElementById("playerLevel");
            if (levelDisplay) {
                levelDisplay.classList.add("hide");
            }
        }
    });
    const displayNameContainer = document.querySelector(".name");
    
    // Handle authentication state
    onAuthStateChanged(auth, (user) => {
        if (user && displayNameContainer) {
            displayNameContainer.textContent = user.displayName || user.email || "-no credentials-disabled account-";
            displayNameContainer.classList.remove("hide");
            document.querySelector("[login]")?.classList.add("hide");
            document.querySelector("[signup]")?.classList.add("hide");
            document.querySelector("[logout]")?.classList.remove("hide");
        } else {
            // Hide level when logged out
            const levelDisplay = document.getElementById("playerLevel");
            if (levelDisplay) {
                levelDisplay.classList.add("hide");
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
    
    // Function to update background and styling based on mode
    function updateModeStyling(mode) {
        // Remove all mode classes from body
        document.body.classList.remove("mode-easy", "mode-normal", "mode-master", "mode-hell", "mode-secret");
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
            if (selectedMode === "normal") {
                window.location.href = "normal.html";
            } else if (selectedMode === "master") {
                window.location.href = "master.html";
            } else if (selectedMode === "hell") {
                window.location.href = "hell.html";
            } else if (selectedMode === "easy") {
                window.location.href = "easy.html";
            } else if (selectedMode === "secret") {
                window.location.href = "secret.html";
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