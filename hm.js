import { getAuth, onAuthStateChanged, signOut } from "./firebase.js";

const auth = getAuth();
let selectedMode = "normal"; // Default mode

document.addEventListener("DOMContentLoaded", () => {
    const displayNameContainer = document.querySelector(".name");
    
    // Handle authentication state
    onAuthStateChanged(auth, (user) => {
        if (user && displayNameContainer) {
            displayNameContainer.textContent = user.displayName || user.email || "-no credentials-disabled account-";
            displayNameContainer.classList.remove("hide");
            document.querySelector("[login]")?.classList.add("hide");
            document.querySelector("[signup]")?.classList.add("hide");
            document.querySelector("[logout]")?.classList.remove("hide");
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
        document.body.classList.remove("mode-easy", "mode-normal", "mode-master", "mode-hell");
        // Add the appropriate mode class
        document.body.classList.add(`mode-${mode}`);
    }
    
    // Set initial active state and styling
    modeCards.forEach(card => {
        if (card.dataset.mode === selectedMode) {
            card.classList.add("active");
            updateModeStyling(selectedMode);
        }
        
        card.addEventListener("click", () => {
            // Remove active class from all cards
            modeCards.forEach(c => c.classList.remove("active"));
            // Add active class to clicked card
            card.classList.add("active");
            selectedMode = card.dataset.mode;
            // Update background and styling
            updateModeStyling(selectedMode);
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
});