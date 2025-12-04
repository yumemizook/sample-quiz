import { getAuth, getFirestore, collection, getDocs, onAuthStateChanged } from "./firebase.js";

const auth = getAuth();
const db = getFirestore();

// Helper function to compare line colors (orange > green > white)
// Returns: 1 if line1 > line2, -1 if line1 < line2, 0 if equal
function compareLineColors(line1, line2) {
    const lineOrder = { "orange": 3, "green": 2, "white": 1, "": 1 };
    const val1 = lineOrder[line1] || 1;
    const val2 = lineOrder[line2] || 1;
    return val1 - val2;
}

// Function to compare hell mode grades (S1, S2, ..., S20, Grand Master - Infinity, Invalid)
// Now accepts optional line color parameters for tiebreaking
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
// Now accepts optional line color parameters for tiebreaking
function compareMasterGrades(grade1, grade2, line1 = "", line2 = "") {
    // Special cases: "GM" or "Grand Master" is the best, "Invalid" is the worst
    if (grade1 === "GM" || grade1 === "Grand Master") return 1;
    if (grade2 === "GM" || grade2 === "Grand Master") return -1;
    if (grade1 === "Invalid") return -1;
    if (grade2 === "Invalid") return 1;
    
    // Grade hierarchy: 9 < 8 < 7 < 6 < 5 < 4 < 3 < 2 < 1 < S1 < S2 < ... < S9 < GM
    const gradeOrder = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "GM", "Grand Master"];
    
    const index1 = gradeOrder.indexOf(grade1);
    const index2 = gradeOrder.indexOf(grade2);
    
    let gradeComparison = 0;
    
    // If both grades are in the order, compare by index
    if (index1 !== -1 && index2 !== -1) {
        gradeComparison = index1 - index2;
    } else {
        // If one grade is not in the order, try to parse it
        // Handle numeric grades (9-1)
        const num1 = parseInt(grade1);
        const num2 = parseInt(grade2);
        
        if (!isNaN(num1) && !isNaN(num2)) {
            // For numeric grades, higher number is worse (9 < 8 < ... < 1)
            gradeComparison = num2 - num1;
        } else if (grade1.startsWith("S") && grade2.startsWith("S")) {
            // Handle S grades
            const sNum1 = parseInt(grade1.substring(1));
            const sNum2 = parseInt(grade2.substring(1));
            if (!isNaN(sNum1) && !isNaN(sNum2)) {
                gradeComparison = sNum1 - sNum2; // S1 < S2 < ... < S9
            }
        }
    }
    
    // If grades are equal, compare by line color (orange > green > white)
    if (gradeComparison === 0) {
        return compareLineColors(line1, line2);
    }
    
    return gradeComparison;
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
            // For hell mode, sort by numeric value of S grades with line color tiebreaker
            const entriesWithGrades = list
                .map((s) => ({ grade: s.grade || "", line: s.line || "white" }))
                .filter((e) => e.grade);
            if (entriesWithGrades.length > 0) {
                entriesWithGrades.sort((a, b) => compareHellGrades(a.grade, b.grade, a.line, b.line));
                bestGrade = entriesWithGrades.reverse()[0].grade;
            } else {
                bestGrade = "-";
            }
        } else if (isMasterMode) {
            // For master mode, use master grade comparison with line color tiebreaker
            const entriesWithGrades = list
                .map((s) => ({ grade: s.grade || "", line: s.line || "white" }))
                .filter((e) => e.grade);
            if (entriesWithGrades.length > 0) {
                entriesWithGrades.sort((a, b) => compareMasterGrades(a.grade, b.grade, a.line, b.line));
                bestGrade = entriesWithGrades.reverse()[0].grade;
            } else {
                bestGrade = "-";
            }
        } else {
            // For other modes, use lexicographic sorting with line color tiebreaker
            const entriesWithGrades = list
                .map((s) => ({ grade: s.grade || "", line: s.line || "white" }))
                .filter((e) => e.grade);
            if (entriesWithGrades.length > 0) {
                entriesWithGrades.sort((a, b) => {
                    const gradeComp = b.grade.localeCompare(a.grade);
                    if (gradeComp === 0) {
                        return compareLineColors(a.line, b.line);
                    }
                    return gradeComp;
                });
                bestGrade = entriesWithGrades[0].grade;
            } else {
                bestGrade = "-";
            }
        }
    }
    return { games, bestScore, avgScore, bestGrade };
}

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

document.addEventListener("DOMContentLoaded", () => {
    // Initialize tabs
    initTabs();
    
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

            const fillRow = (tableId, stats, hasGrade = false, isMaster = false, dataList = []) => {
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
                // Format grade for display (convert "Grand Master - Infinity" to "GM-∞")
                const formatGrade = (grade) => {
                    if (!grade || grade === "-") return "-";
                    if (grade === "Grand Master - Infinity") return "GM-∞";
                    return grade;
                };
                
                // Get line color for grade display (from stored data or default)
                const getLineColor = (gradeData) => {
                    if (!gradeData || !gradeData.line) return "white";
                    const lineColor = gradeData.line;
                    // Map line colors: white, orange, green
                    if (lineColor === "orange") return "#ff8800";
                    if (lineColor === "green") return "#00ff00";
                    return "#ffffff"; // white
                };
                
                if (hasGrade) {
                    // Find the entry with the best grade to get its line color
                    let bestGradeEntry = null;
                    if (stats.bestGrade && stats.bestGrade !== "-" && dataList.length > 0) {
                        // Find entry with matching grade
                        bestGradeEntry = dataList.find(s => {
                            const grade = s.grade || "";
                            return grade === stats.bestGrade || 
                                   (stats.bestGrade === "GM-∞" && grade === "Grand Master - Infinity");
                        });
                    }
                    
                    const lineColor = bestGradeEntry ? getLineColor(bestGradeEntry) : "#ffffff";
                    const gradeDisplay = stats.bestGrade && stats.bestGrade !== "-" 
                        ? `<span class="grade-badge" style="color: ${lineColor}">${formatGrade(stats.bestGrade)}</span>` 
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

            // Function to fill history table with all player entries
            const fillHistoryTable = (tableId, dataList, hasGrade = false, isMaster = false) => {
                const table = document.querySelector(`#${tableId}`);
                if (!table) return;
                
                // Clear existing rows
                const tbody = table.querySelector("tbody");
                if (tbody) {
                    tbody.innerHTML = "";
                } else {
                    const newTbody = document.createElement("tbody");
                    table.appendChild(newTbody);
                }
                
                if (!dataList || dataList.length === 0) {
                    // Show "no scores" message
                    const tbody = table.querySelector("tbody");
                    if (tbody) {
                        const colspan = hasGrade ? 4 : 3;
                        tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.7);">No scores available yet</td></tr>`;
                    }
                    return;
                }
                
                // Sort by date (newest first), then by grade/score if same date
                const sortedList = [...dataList].sort((a, b) => {
                    const dateA = a.date ? new Date(a.date) : new Date(0);
                    const dateB = b.date ? new Date(b.date) : new Date(0);
                    const dateDiff = dateB - dateA; // Newest first
                    
                    if (dateDiff !== 0) return dateDiff;
                    
                    // If same date, sort by grade (best first) with line color tiebreaker
                    if (hasGrade && a.grade && b.grade) {
                        let gradeComp = 0;
                        if (isMaster) {
                            gradeComp = compareMasterGrades(a.grade, b.grade, a.line || "white", b.line || "white");
                        } else {
                            // For normal/hell mode, use appropriate comparison
                            gradeComp = compareHellGrades(a.grade, b.grade, a.line || "white", b.line || "white");
                        }
                        if (gradeComp !== 0) return -gradeComp; // Reverse for descending
                    }
                    
                    // If still equal, sort by score (highest first)
                    return (b.score || 0) - (a.score || 0);
                });
                
                // Format functions
                const formatScore = (score) => {
                    if (score === undefined || score === null) return "-";
                    if (isMaster && typeof score === "number") {
                        return score.toLocaleString();
                    }
                    return score;
                };
                
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
                    return "#ffffff"; // white
                };
                
                // Add rows (limit to most recent 50 entries)
                sortedList.slice(0, 50).forEach((entry) => {
                    const row = document.createElement("tr");
                    const dateStr = entry.date ? new Date(entry.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : "Unknown";
                    
                    if (hasGrade) {
                        const gradeDisplay = entry.grade 
                            ? `<span class="grade-badge" style="color: ${getLineColor(entry)}">${formatGrade(entry.grade)}</span>` 
                            : "-";
                        row.innerHTML = `
                            <td>${dateStr}</td>
                            <td class="${entry.score ? "high-score" : ""}">${formatScore(entry.score)}</td>
                            <td>${gradeDisplay}</td>
                            <td>${entry.time || "-"}</td>
                        `;
                    } else {
                        row.innerHTML = `
                            <td>${dateStr}</td>
                            <td class="${entry.score ? "high-score" : ""}">${formatScore(entry.score)}</td>
                            <td>${entry.time || "-"}</td>
                        `;
                    }
                    
                    if (tbody) {
                        tbody.appendChild(row);
                    }
                });
            };

            fillRow("easyStats", easyStats, false, false, easyList);
            fillRow("normalStats", normalStats, true, false, normalList);
            fillRow("masterStats", masterStats, true, true, masterList); // Master mode uses total grade points
            fillRow("hellStats", hellStats, true, false, hellList);

            // Fill player history tables
            fillHistoryTable("easyHistory", easyList, false, false);
            fillHistoryTable("normalHistory", normalList, true, false);
            fillHistoryTable("masterHistory", masterList, true, true);
            fillHistoryTable("hellHistory", hellList, true, false);

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
    if (!canvas) {
        return;
    }
    
    // Show "no scores" message if no data
    if (!dataList || dataList.length === 0) {
        const parentCard = canvas.closest('.stats-card');
        if (parentCard) {
            // Remove canvas and add message
            canvas.style.display = "none";
            let noDataMsg = parentCard.querySelector('.no-data-message');
            if (!noDataMsg) {
                noDataMsg = document.createElement('div');
                noDataMsg.className = 'no-data-message';
                noDataMsg.style.cssText = 'text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7); font-size: 1.1em;';
                noDataMsg.textContent = 'No scores available yet';
                parentCard.appendChild(noDataMsg);
            }
        }
        return;
    }
    
    // Remove any existing "no data" message
    const parentCard = canvas.closest('.stats-card');
    if (parentCard) {
        const noDataMsg = parentCard.querySelector('.no-data-message');
        if (noDataMsg) {
            noDataMsg.remove();
        }
        canvas.style.display = "block";
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

    // Calculate z-scores for each entry
    // Z-score = (x - mean) / standardDeviation
    const calculateZScore = (scores) => {
        if (scores.length === 0) return [];
        
        // Calculate mean
        const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        
        // Calculate variance
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
        
        // Calculate standard deviation
        const stdDev = Math.sqrt(variance);
        
        // If standard deviation is 0, all scores are the same, so z-scores are 0
        if (stdDev === 0) {
            return scores.map(() => 0);
        }
        
        // Calculate z-scores
        return scores.map(score => (score - mean) / stdDev);
    };
    
    const zScores = calculateZScore(scores);

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
                            const score = context.parsed.y;
                            const zScore = zScores[context.dataIndex];
                            const zScoreFormatted = zScore !== undefined ? zScore.toFixed(2) : 'N/A';
                            return [
                                'Score: ' + score.toLocaleString(),
                                'Z-Score: ' + zScoreFormatted
                            ];
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


