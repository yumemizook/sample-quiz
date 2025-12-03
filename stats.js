import { getAuth, getFirestore, collection, getDocs, onAuthStateChanged } from "./firebase.js";

const auth = getAuth();
const db = getFirestore();

// Function to compare hell mode grades (S1, S2, ..., S20, Grand Master - Infinity, Invalid)
function compareHellGrades(grade1, grade2) {
    // Special cases: "Grand Master - Infinity" is the best, "Invalid" is the worst
    if (grade1 === "Grand Master - Infinity") return 1;
    if (grade2 === "Grand Master - Infinity") return -1;
    if (grade1 === "Invalid") return -1;
    if (grade2 === "Invalid") return 1;
    
    // Extract numbers from S grades (e.g., "S5" -> 5, "S20" -> 20)
    const extractSNumber = (grade) => {
        if (grade.startsWith("S")) {
            const num = parseInt(grade.substring(1));
            return isNaN(num) ? 0 : num;
        }
        return 0;
    };
    
    const num1 = extractSNumber(grade1);
    const num2 = extractSNumber(grade2);
    
    // Compare numerically
    return num1 - num2;
}

// Function to compare master mode grades (9 to 1, then S1 to S9, then Grand Master)
function compareMasterGrades(grade1, grade2) {
    // Special cases: "GM" or "Grand Master" is the best, "Invalid" is the worst
    if (grade1 === "GM" || grade1 === "Grand Master") return 1;
    if (grade2 === "GM" || grade2 === "Grand Master") return -1;
    if (grade1 === "Invalid") return -1;
    if (grade2 === "Invalid") return 1;
    
    // Grade hierarchy: 9 < 8 < 7 < 6 < 5 < 4 < 3 < 2 < 1 < S1 < S2 < ... < S9 < GM
    const gradeOrder = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "GM", "Grand Master"];
    
    const index1 = gradeOrder.indexOf(grade1);
    const index2 = gradeOrder.indexOf(grade2);
    
    // If both grades are in the order, compare by index
    if (index1 !== -1 && index2 !== -1) {
        return index1 - index2;
    }
    
    // If one grade is not in the order, try to parse it
    // Handle numeric grades (9-1)
    const num1 = parseInt(grade1);
    const num2 = parseInt(grade2);
    
    if (!isNaN(num1) && !isNaN(num2)) {
        // For numeric grades, higher number is worse (9 < 8 < ... < 1)
        return num2 - num1;
    }
    
    // Handle S grades
    if (grade1.startsWith("S") && grade2.startsWith("S")) {
        const sNum1 = parseInt(grade1.substring(1));
        const sNum2 = parseInt(grade2.substring(1));
        if (!isNaN(sNum1) && !isNaN(sNum2)) {
            return sNum1 - sNum2; // S1 < S2 < ... < S9
        }
    }
    
    // Fallback: unknown grades
    return 0;
}

function summarizeScores(list, hasGrade = false, isHellMode = false, isMasterMode = false) {
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
        if (isHellMode) {
            // For hell mode, sort by numeric value of S grades
            const grades = list
                .map((s) => s.grade || "")
                .filter((g) => g);
            if (grades.length > 0) {
                bestGrade = grades.sort(compareHellGrades).reverse()[0];
            } else {
                bestGrade = "-";
            }
        } else if (isMasterMode) {
            // For master mode, use master grade comparison
            const grades = list
                .map((s) => s.grade || "")
                .filter((g) => g);
            if (grades.length > 0) {
                bestGrade = grades.sort(compareMasterGrades).reverse()[0];
            } else {
                bestGrade = "-";
            }
        } else {
            // For other modes, use lexicographic sorting
            bestGrade =
                list
                    .map((s) => s.grade || "")
                    .filter((g) => g)
                    .sort()
                    .reverse()[0] || "-";
        }
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
            const masterStats = summarizeScores(masterList, true, false, true); // Pass true for isMasterMode
            const hellStats = summarizeScores(hellList, true, true); // Pass true for isHellMode

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
                    const gradeDisplay = stats.bestGrade && stats.bestGrade !== "-" 
                        ? `<span class="grade-badge">${stats.bestGrade}</span>` 
                        : "-";
                    row.innerHTML = `
                        <td>${stats.games}</td>
                        <td class="${stats.bestScore !== "-" ? "high-score" : ""}">${formatScore(stats.bestScore)}</td>
                        <td>${formatScore(stats.avgScore)}</td>
                        <td>${gradeDisplay}</td>
                    `;
                } else {
                    row.innerHTML = `
                        <td>${stats.games}</td>
                        <td class="${stats.bestScore !== "-" ? "high-score" : ""}">${formatScore(stats.bestScore)}</td>
                        <td>${formatScore(stats.avgScore)}</td>
                    `;
                }
                tbody.appendChild(row);
            };

            fillRow("easyStats", easyStats, false);
            fillRow("normalStats", normalStats, true);
            fillRow("masterStats", masterStats, true, true); // Master mode uses total grade points
            fillRow("hellStats", hellStats, true);

            // Create charts for each mode
            createChart("easyChart", easyList, "Easy Mode", "#adffcd");
            createChart("normalChart", normalList, "Normal Mode", "#dbffff");
            createChart("masterChart", masterList, "Master Mode", "#dbffff");
            createChart("hellChart", hellList, "Hell Mode", "#ffbaba");
        } catch (error) {
            console.error("Error loading player stats:", error);
        }
    });
});

// Function to create a chart showing score progression over time
function createChart(canvasId, dataList, label, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !dataList || dataList.length === 0) {
        if (canvas) {
            canvas.parentElement.style.display = "none";
        }
        return;
    }

    // Sort data by date (oldest to newest)
    const sortedData = [...dataList].sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateA - dateB;
    });

    // Extract dates and scores
    const dates = sortedData.map(item => {
        if (!item.date) return "Unknown";
        try {
            const date = new Date(item.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch {
            return item.date;
        }
    });
    
    const scores = sortedData.map(item => item.score || 0);

    // Chart.js configuration
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Score',
                data: scores,
                borderColor: color,
                backgroundColor: color + '40', // Add transparency
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
                    callbacks: {
                        label: function(context) {
                            return 'Score: ' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#dbffff',
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#dbffff',
                        font: {
                            size: 10
                        },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}


