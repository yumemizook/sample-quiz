import { getAuth, getFirestore, collection, getDocs, onAuthStateChanged } from "./firebase.js";

const auth = getAuth();
const db = getFirestore();

function summarizeScores(list, hasGrade = false) {
    if (!list.length) {
        return {
            games: 0,
            bestScore: "-",
            avgScore: "-",
            bestGrade: hasGrade ? "-" : undefined,
        };
    }
    const games = list.length;
    const bestScore = Math.max(...list.map((s) => s.score || 0));
    const avgScore =
        Math.round(
            (list.reduce((sum, s) => sum + (s.score || 0), 0) / games) * 100
        ) / 100;
    let bestGrade = undefined;
    if (hasGrade) {
        // Just take the max grade lexicographically as a simple heuristic
        bestGrade =
            list
                .map((s) => s.grade || "")
                .filter((g) => g)
                .sort()
                .reverse()[0] || "-";
    }
    return { games, bestScore, avgScore, bestGrade };
}

document.addEventListener("DOMContentLoaded", () => {
    const nameSpan = document.querySelector(".name");
    const statsContainer = document.querySelector(".container2");

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            if (nameSpan) {
                nameSpan.textContent = "Log in to see your stats";
                nameSpan.classList.remove("hide");
            }
            // Hide the stats container when logged out
            if (statsContainer) {
                statsContainer.style.display = "none";
            }
            // Show login/signup links, hide logout
            document.querySelector("[login]")?.classList.remove("hide");
            document.querySelector("[signup]")?.classList.remove("hide");
            document.querySelector("[logout]")?.classList.add("hide");
            return;
        }

        const displayName = user.displayName || user.email;
        if (nameSpan) {
            nameSpan.textContent = displayName;
            nameSpan.classList.remove("hide");
            document.querySelector("[login]")?.classList.add("hide");
            document.querySelector("[signup]")?.classList.add("hide");
            document.querySelector("[logout]")?.classList.remove("hide");
        }
        // Show the stats container when logged in
        if (statsContainer) {
            statsContainer.style.display = "";
        }

        try {
            // Read per‑player data from Firestore subcollections
            const uid = user.uid;
            const [easySnap, normalSnap, masterSnap, hellSnap] = await Promise.all([
                getDocs(collection(db, "playerData", uid, "easy")),
                getDocs(collection(db, "playerData", uid, "normal")),
                getDocs(collection(db, "playerData", uid, "master")),
                getDocs(collection(db, "playerData", uid, "hell")),
            ]);

            const listFromSnap = (snap) => {
                if (snap.empty) return [];
                return snap.docs.map((doc) => doc.data());
            };

            const easyList = listFromSnap(easySnap);
            const normalList = listFromSnap(normalSnap);
            const masterList = listFromSnap(masterSnap);
            const hellList = listFromSnap(hellSnap);

            const easyStats = summarizeScores(easyList, false);
            const normalStats = summarizeScores(normalList, true);
            // For master mode, use totalGradePoints (stored as score) instead of answer count
            const masterStats = summarizeScores(masterList, true);
            const hellStats = summarizeScores(hellList, true);

            const fillRow = (tableId, stats, hasGrade = false, isMaster = false) => {
                const table = document.querySelector(`#${tableId}`);
                if (!table) return;
                // Clear existing rows first
                const existingRows = table.querySelectorAll("tbody tr");
                existingRows.forEach(row => row.remove());
                // Create tbody if it doesn't exist
                let tbody = table.querySelector("tbody");
                if (!tbody) {
                    tbody = document.createElement("tbody");
                    table.appendChild(tbody);
                }
                const row = document.createElement("tr");
                // Format score for master mode (total grade points) with commas
                const formatScore = (score) => {
                    if (score === "-") return "-";
                    if (isMaster && typeof score === "number") {
                        return score.toLocaleString();
                    }
                    return score;
                };
                if (hasGrade) {
                    row.innerHTML = `
                        <td>${stats.games}</td>
                        <td>${formatScore(stats.bestScore)}</td>
                        <td>${formatScore(stats.avgScore)}</td>
                        <td>${stats.bestGrade}</td>
                    `;
                } else {
                    row.innerHTML = `
                        <td>${stats.games}</td>
                        <td>${formatScore(stats.bestScore)}</td>
                        <td>${formatScore(stats.avgScore)}</td>
                    `;
                }
                tbody.appendChild(row);
            };

            fillRow("easyStats", easyStats, false);
            fillRow("normalStats", normalStats, true);
            fillRow("masterStats", masterStats, true, true); // Master mode uses total grade points
            fillRow("hellStats", hellStats, true);
        } catch (error) {
            console.error("Error loading player stats:", error);
        }
    });
});


