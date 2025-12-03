import { getAuth, getDatabase } from "./firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const auth = getAuth();
const db = getDatabase();

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

document.addEventListener("DOMContentLoaded", async () => {
    const user = auth.currentUser;
    const nameSpan = document.querySelector(".name");

    if (!user) {
        if (nameSpan) {
            nameSpan.textContent = "Log in to see your stats";
            nameSpan.classList.remove("hide");
        }
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

    try {
        const [easySnap, normalSnap, masterSnap, hellSnap] = await Promise.all([
            get(ref(db, "scoreseasy")),
            get(ref(db, "scores")),
            get(ref(db, "scoresmaster")),
            get(ref(db, "scoresfinal")),
        ]);

        const filterByUser = (snap) => {
            if (!snap.exists()) return [];
            const all = Object.values(snap.val());
            return all.filter((s) => s.name === displayName);
        };

        const easyList = filterByUser(easySnap);
        const normalList = filterByUser(normalSnap);
        const masterList = filterByUser(masterSnap);
        const hellList = filterByUser(hellSnap);

        const easyStats = summarizeScores(easyList, false);
        const normalStats = summarizeScores(normalList, true);
        const masterStats = summarizeScores(masterList, true);
        const hellStats = summarizeScores(hellList, true);

        const fillRow = (tableId, stats, hasGrade = false) => {
            const table = document.querySelector(`#${tableId}`);
            if (!table) return;
            const row = document.createElement("tr");
            if (hasGrade) {
                row.innerHTML = `
                    <td>${stats.games}</td>
                    <td>${stats.bestScore}</td>
                    <td>${stats.avgScore}</td>
                    <td>${stats.bestGrade}</td>
                `;
            } else {
                row.innerHTML = `
                    <td>${stats.games}</td>
                    <td>${stats.bestScore}</td>
                    <td>${stats.avgScore}</td>
                `;
            }
            table.appendChild(row);
        };

        fillRow("easyStats", easyStats, false);
        fillRow("normalStats", normalStats, true);
        fillRow("masterStats", masterStats, true);
        fillRow("hellStats", hellStats, true);
    } catch (error) {
        console.error("Error loading player stats:", error);
    }
});


