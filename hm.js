import { getAuth, onAuthStateChanged, signOut } from "./firebase.js";

const auth = getAuth();
const displayNameContainer = document.querySelector(".name");
document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user && displayNameContainer) {
            displayNameContainer.textContent = user.displayName || user.email || "-no credentials-disabled account-";
            displayNameContainer.classList.remove("hide");
            document.querySelector("[login]")?.classList.add("hide");
            document.querySelector("[signup]")?.classList.add("hide");
            document.querySelector("[logout]")?.classList.remove("hide");
        }
    });
});

document.querySelector("[logout]").addEventListener("click", async () => {
    signOut(auth).then(() => {
        displayNameContainer.textContent = "";
        displayNameContainer.classList.add("hide");
        document.querySelector("[login]").classList.remove("hide");
        document.querySelector("[signup]").classList.remove("hide");
        document.querySelector("[logout]").classList.add("hide");
    }).catch((error) => {
        console.error("Error signing out:", error);
        alert("An error occurred while signing out. Please try again.");
    });
});
let tooltip = document.querySelector(".explain");
let selectedMode = document.querySelector("#mode").value;

// Function to update tooltip based on selected mode
function updateTooltip(mode) {
    switch (mode) {
        case "normal":
            tooltip.textContent = "Answer questions to score points. The more you answer, the higher your score. There is no time limit until the end of the first half, but you can only answer each question once.";
            break;
        case "master":
            tooltip.textContent = "Answer questions with a slowly shrinking time limit. Getting a question wrong will not allow you to progress. Can you be the Grand Master?";
            break;
        case "hell":
            tooltip.textContent = "Extremely difficult questions with inhumane time limits. Only the most skilled can hope to be close to beating this mode. Not for the faint of heart.";
            break;
        case "easy":
            tooltip.textContent = "A mode for beginners. Answer 30 easy questions as fast as you can! Perfect for those new to the game.";
            break;
        default:
            tooltip.textContent = "";
    }
}

// Initialize tooltip on page load
updateTooltip(selectedMode);

document.querySelector("#mode").addEventListener("change", (event) => {
    selectedMode = event.target.value;
    updateTooltip(selectedMode);
});

document.querySelector(".play").addEventListener("click", () => {
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

document.querySelector(".hiscore").addEventListener("click", () => {
    window.location.href = "IR.html";
});

const statsBtn = document.querySelector(".stats");
if (statsBtn) {
    statsBtn.addEventListener("click", () => {
        window.location.href = "stats.html";
    });
}