import { getFirestore, collection, getDocs } from "./firebase.js";

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

document.addEventListener("DOMContentLoaded", async () => {
    // Initialize tabs
    initTabs();
    try {
        const snapshot = await getDocs(highScoresRef);
        const masterSnapshot = await getDocs(masterModeRef);
        const easySnapshot = await getDocs(easyModeRef);
        const finalSnapshot = await getDocs(finalModeRef);
        if (!snapshot.empty) {
            const highScoresArrRaw = snapshot.docs.map((doc) => doc.data());
            const highScoresList = document.querySelector("#scoreTable2");
            // Convert object to array and sort by score descending
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
            };
            const highScoresArr = highScoresArrRaw.sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score; // Sort by score in descending order
                }
                // If scores are equal, compare by grade (if both have grades)
                if (a.grade && b.grade && a.grade !== b.grade) {
                    // Simple lexicographic comparison for normal mode
                    const gradeComp = b.grade.localeCompare(a.grade);
                    if (gradeComp !== 0) return gradeComp;
                }
                // If grades are equal (or both missing), compare by line color
                if (a.grade && b.grade && a.grade === b.grade) {
                    const lineComp = compareLineColors(a.line || "white", b.line || "white");
                    if (lineComp !== 0) return -lineComp; // Reverse for descending (orange > green > white)
                }
                // Finally, sort by time in ascending order
                return parseTime(a.time) - parseTime(b.time);
            });
            if (highScoresList) {
                highScoresArr.forEach((scoreData, index) => {
                    const rank = index + 1;
                    const listItem = document.createElement("tr");
                // Format grade and apply line color
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
                const gradeDisplay = scoreData.grade 
                    ? `<span class="grade-badge" style="color: ${getLineColor(scoreData)}">${formatGrade(scoreData.grade)}</span>` 
                    : "-";
                    listItem.innerHTML = `
                        <td>${rank}</td>
                        <td>${scoreData.name}</td>
                        <td class="high-score">${scoreData.score}</td>
                        <td>${gradeDisplay}</td>
                        <td>${scoreData.time}</td>
                        <td>${scoreData.date}</td>
                    `;
                    highScoresList.appendChild(listItem);
                });
            } else {
                console.warn("Element with ID 'scoreTable' not found.");
            }
        } else {
            // Show "no scores" message for normal mode
            const highScoresList = document.querySelector("#scoreTable2");
            if (highScoresList) {
                const tbody = highScoresList.querySelector("tbody") || highScoresList.appendChild(document.createElement("tbody"));
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.7);">No scores available yet</td></tr>`;
            }
        }
        if (!easySnapshot.empty) {
            const easyScoresArrRaw = easySnapshot.docs.map((doc) => doc.data());
            const easyScoresList = document.querySelector("#scoreTable");
            // Convert object to array and sort by score descending
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
            };
            const easyScoresArr = easyScoresArrRaw.sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score; // Sort by score in descending order
                } else {
                    return parseTime(a.time) - parseTime(b.time); // Sort by time in ascending order if scores are equal
                }
            });
            if (easyScoresList) {
                easyScoresArr.forEach((scoreData, index) => {
                    const rank = index + 1;
                    const listItem = document.createElement("tr");
                    listItem.innerHTML = `
                        <td>${rank}</td>
                        <td>${scoreData.name}</td>
                        <td class="high-score">${scoreData.score}</td>
                        <td>${scoreData.time}</td>
                        <td>${scoreData.date}</td>
                    `;
                    easyScoresList.appendChild(listItem);
                });
            } else {
                console.warn("Element with ID 'scoreTable' not found.");
            }
        } else {
            // Show "no scores" message for easy mode
            const easyScoresList = document.querySelector("#scoreTable");
            if (easyScoresList) {
                const tbody = easyScoresList.querySelector("tbody") || easyScoresList.appendChild(document.createElement("tbody"));
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.7);">No scores available yet</td></tr>`;
            }
        }
        if (!finalSnapshot.empty) {
            const finalScoresArrRaw = finalSnapshot.docs.map((doc) => doc.data());
            const finalScoresList = document.querySelector("#scoreTable4");
            // Convert object to array and sort by score descending
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
            };
            const finalScoresArr = finalScoresArrRaw.sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score; // Sort by score in descending order
                }
                // If scores are equal, compare by grade (if both have grades)
                if (a.grade && b.grade && a.grade !== b.grade) {
                    // Hell mode: compare S grades numerically, GM-∞ is best
                    if (a.grade === "Grand Master - Infinity") return -1;
                    if (b.grade === "Grand Master - Infinity") return 1;
                    if (a.grade.startsWith("S") && b.grade.startsWith("S")) {
                        const num1 = parseInt(a.grade.substring(1)) || 0;
                        const num2 = parseInt(b.grade.substring(1)) || 0;
                        const gradeComp = num1 - num2;
                        if (gradeComp !== 0) return -gradeComp; // Reverse for descending
                    } else {
                        const gradeComp = b.grade.localeCompare(a.grade);
                        if (gradeComp !== 0) return gradeComp;
                    }
                }
                // If grades are equal (or both missing), compare by line color
                if (a.grade && b.grade && a.grade === b.grade) {
                    const lineComp = compareLineColors(a.line || "white", b.line || "white");
                    if (lineComp !== 0) return -lineComp; // Reverse for descending (orange > green > white)
                }
                // Finally, sort by time in ascending order
                return parseTime(a.time) - parseTime(b.time);
            });
            if (finalScoresList) {
                finalScoresArr.forEach((scoreData, index) => {
                    const rank = index + 1;
                    const listItem = document.createElement("tr");
                // Format grade and apply line color
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
                const gradeDisplay = scoreData.grade 
                    ? `<span class="grade-badge" style="color: ${getLineColor(scoreData)}">${formatGrade(scoreData.grade)}</span>` 
                    : "-";
                    listItem.innerHTML = `
                        <td>${rank}</td>
                        <td>${scoreData.name}</td>
                        <td class="high-score">${scoreData.score}</td>
                        <td>${gradeDisplay}</td>
                        <td>${scoreData.time}</td>
                        <td>${scoreData.date}</td>
                    `;
                    finalScoresList.appendChild(listItem);
                });
            } else {
                console.warn("Element with ID 'scoreTable4' not found.");
            }
        } else {
            // Show "no scores" message for hell mode
            const finalScoresList = document.querySelector("#scoreTable4");
            if (finalScoresList) {
                const tbody = finalScoresList.querySelector("tbody") || finalScoresList.appendChild(document.createElement("tbody"));
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.7);">No scores available yet</td></tr>`;
            }
        }

        if (!masterSnapshot.empty) {
            const masterScoresArrRaw = masterSnapshot.docs.map((doc) => doc.data());
            const masterScoresList = document.querySelector("#scoreTable3");
            // Convert object to array and sort by score descending
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
            };
            const masterScoresArr = masterScoresArrRaw.sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score; // Sort by score in descending order
                }
                // If scores are equal, compare by grade (if both have grades)
                if (a.grade && b.grade && a.grade !== b.grade) {
                    // Master mode grade comparison (9 < 8 < ... < 1 < S1 < ... < S9 < GM)
                    const gradeOrder = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "GM", "Grand Master"];
                    const index1 = gradeOrder.indexOf(a.grade);
                    const index2 = gradeOrder.indexOf(b.grade);
                    if (index1 !== -1 && index2 !== -1) {
                        const gradeComp = index1 - index2;
                        if (gradeComp !== 0) return -gradeComp; // Reverse for descending
                    }
                }
                // If grades are equal (or both missing), compare by line color
                if (a.grade && b.grade && a.grade === b.grade) {
                    const lineComp = compareLineColors(a.line || "white", b.line || "white");
                    if (lineComp !== 0) return -lineComp; // Reverse for descending (orange > green > white)
                }
                // Finally, sort by time in ascending order
                return parseTime(a.time) - parseTime(b.time);
            });
            if (masterScoresList) {
                masterScoresArr.forEach((scoreData, index) => {
                    const rank = index + 1;
                    const listItem = document.createElement("tr");
                // Format grade and apply line color
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
                const gradeDisplay = scoreData.grade 
                    ? `<span class="grade-badge" style="color: ${getLineColor(scoreData)}">${formatGrade(scoreData.grade)}</span>` 
                    : "-";
                    listItem.innerHTML = `
                        <td>${rank}</td>
                        <td>${scoreData.name}</td>
                        <td class="high-score">${scoreData.score}</td>
                        <td>${gradeDisplay}</td>
                        <td>${scoreData.time}</td>
                        <td>${scoreData.date}</td>
                    `;
                    masterScoresList.appendChild(listItem);
                });
            } else {
                console.warn("Element with ID 'scoreTable3' not found.");
            }
        } else {
            // Show "no scores" message for master mode
            const masterScoresList = document.querySelector("#scoreTable3");
            if (masterScoresList) {
                const tbody = masterScoresList.querySelector("tbody") || masterScoresList.appendChild(document.createElement("tbody"));
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.7);">No scores available yet</td></tr>`;
            }
        }
    } catch (error) {
        console.error("Error fetching high scores:", error);
    }
});
