import { getAuth, getFirestore, collection, getDocs, onAuthStateChanged } from "./firebase.js";

const auth = getAuth();
const db = getFirestore();

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

// Store raw data lists for filtering
let allEasyList = [];
let allNormalList = [];
let allMasterList = [];
let allHellList = [];

// Update level progression display
function updateLevelProgression(playerData) {
    const levelProgressionCard = document.getElementById("levelProgression");
    const levelDisplay = document.getElementById("playerLevelDisplay");
    const currentXP = document.getElementById("currentXP");
    const nextLevelXP = document.getElementById("nextLevelXP");
    const xpProgressBar = document.getElementById("xpProgressBar");
    const xpProgressText = document.getElementById("xpProgressText");
    
    if (!levelProgressionCard || !levelDisplay || !currentXP || !nextLevelXP || !xpProgressBar) {
        return;
    }
    
    // Show the level progression card
    levelProgressionCard.style.display = "block";
    
    const finalLevel = playerData.level;
    const experience = playerData.experience;
    
    // Level formula: finalLevel = Math.max(1, Math.floor(baseLevel + (experience / 50)))
    // To calculate progress, we need to find the XP range for the current level
    // For finalLevel = N: floor(baseLevel + experience/50) = N
    // This means: N <= baseLevel + experience/50 < N + 1
    // So: (N - baseLevel) * 50 <= experience < (N + 1 - baseLevel) * 50
    
    // Since we don't have baseLevel directly, we'll estimate it
    // The minimum baseLevel for a given finalLevel and experience:
    // baseLevel >= finalLevel - experience/50
    // The maximum baseLevel: baseLevel < finalLevel + 1 - experience/50
    
    // For progress calculation, we'll use the fact that each level requires 50 XP
    // XP needed for level N (assuming baseLevel = 1): (N - 1) * 50
    // XP needed for level N+1: N * 50
    
    // Calculate XP thresholds (using baseLevel = 1 as reference)
    const xpForCurrentLevelMin = (finalLevel - 1) * 50;
    const xpForNextLevelMin = finalLevel * 50;
    
    // Calculate how much XP is in the current level range
    // If experience is less than the minimum for current level, show 0%
    const xpInCurrentLevel = Math.max(0, experience - xpForCurrentLevelMin);
    const xpNeededForNextLevel = xpForNextLevelMin - xpForCurrentLevelMin; // Always 50
    
    // Calculate progress percentage
    const progressPercent = xpNeededForNextLevel > 0 
        ? Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForNextLevel) * 100))
        : 100;
    
    // Update display
    levelDisplay.textContent = `Lv. ${finalLevel}`;
    currentXP.textContent = `${experience} XP`;
    nextLevelXP.textContent = `${xpForNextLevelMin} XP`;
    
    // Update progress bar
    xpProgressBar.style.width = `${progressPercent}%`;
    if (xpProgressText) {
        // Only show text if progress bar is wide enough
        if (progressPercent > 25) {
            xpProgressText.textContent = `${xpInCurrentLevel} / ${xpNeededForNextLevel}`;
        } else {
            xpProgressText.textContent = "";
        }
    }
}

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
            
            // Re-render the stats for this mode
            renderModeStats(mode);
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
        const [easySnap, normalSnap, masterSnap, hellSnap, secretSnap] = await Promise.all([
                getDocs(collection(db, "playerData", uid, "easy")),
                getDocs(collection(db, "playerData", uid, "normal")),
                getDocs(collection(db, "playerData", uid, "master")),
                getDocs(collection(db, "playerData", uid, "hell")),
                getDocs(collection(db, "playerData", uid, "secret")).catch(() => ({ empty: true, docs: [] })),
            ]);

            const listFromSnap = (snap) => {
                if (snap.empty) return [];
                return snap.docs.map((doc) => doc.data());
            };

            // Store raw data lists
            allEasyList = listFromSnap(easySnap);
            allNormalList = listFromSnap(normalSnap);
            allMasterList = listFromSnap(masterSnap);
            allHellList = listFromSnap(hellSnap);
            const secretList = listFromSnap(secretSnap);

            // Calculate and display player level and XP
            const playerData = calculatePlayerLevel(allEasyList, allNormalList, allMasterList, allHellList, secretList);
            updateLevelProgression(playerData);

            // Render all modes
            renderModeStats('easy');
            renderModeStats('normal');
            renderModeStats('master');
            renderModeStats('hell');
        } catch (error) {
            console.error("Error loading player stats:", error);
        }
    });
});

// Render stats for a specific mode based on current filter
function renderModeStats(mode) {
    let dataList = [];
    let hasGrade = false;
    let isMaster = false;
    let isHell = false;
    
    switch(mode) {
        case 'easy':
            dataList = filterScores(allEasyList, currentFilter.easy);
            hasGrade = false;
            isMaster = false;
            break;
        case 'normal':
            dataList = filterScores(allNormalList, currentFilter.normal);
            hasGrade = true;
            isMaster = false;
            break;
        case 'master':
            dataList = filterScores(allMasterList, currentFilter.master);
            hasGrade = true;
            isMaster = true;
            break;
        case 'hell':
            dataList = filterScores(allHellList, currentFilter.hell);
            hasGrade = true;
            isHell = true;
            break;
    }
    
    // Calculate stats
    const stats = summarizeScores(dataList, hasGrade, isHell, isMaster);
    
    // Get table IDs
    const statsTableId = `${mode}Stats`;
    const historyTableId = `${mode}History`;
    const chartId = `${mode}Chart`;
    
    // Fill stats table
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
    
    fillRow(statsTableId, stats, hasGrade, isMaster, dataList);
    
    // Fill history table
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
                const colspan = hasGrade ? 5 : 4;
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
        
        // Format input type with icon
        const formatInputType = (inputType) => {
            if (!inputType || inputType === 'unknown') return "❓";
            if (inputType === 'controller') return "🎮";
            if (inputType === 'keyboard') return "⌨️";
            if (inputType === 'mobile') return "📱";
            return "❓";
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
            const inputTypeDisplay = formatInputType(entry.inputType);
            
            if (hasGrade) {
                const gradeDisplay = entry.grade 
                    ? `<span class="grade-badge" style="color: ${getLineColor(entry)}">${formatGrade(entry.grade)}</span>` 
                    : "-";
                row.innerHTML = `
                    <td>${dateStr}</td>
                    <td class="${entry.score ? "high-score" : ""}">${formatScore(entry.score)}</td>
                    <td>${gradeDisplay}</td>
                    <td>${entry.time || "-"}</td>
                    <td>${inputTypeDisplay}</td>
                `;
            } else {
                row.innerHTML = `
                    <td>${dateStr}</td>
                    <td class="${entry.score ? "high-score" : ""}">${formatScore(entry.score)}</td>
                    <td>${entry.time || "-"}</td>
                    <td>${inputTypeDisplay}</td>
                `;
            }
            
            const tbody = table.querySelector("tbody");
            if (tbody) {
                tbody.appendChild(row);
            }
        });
    };
    
    fillHistoryTable(historyTableId, dataList, hasGrade, isMaster);
    
    // Update chart
    const chartColors = {
        easy: "#adffcd",
        normal: "#dbffff",
        master: "#dbffff",
        hell: "#ffbaba"
    };
    const chartLabels = {
        easy: "Easy Mode",
        normal: "Normal Mode",
        master: "Master Mode",
        hell: "Hell Mode"
    };
    createChart(chartId, dataList, chartLabels[mode], chartColors[mode]);
}

document.addEventListener("DOMContentLoaded", () => {
    // Initialize tabs
    initTabs();
    
    // Initialize input filters
    initInputFilters();
    
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
            const [easySnap, normalSnap, masterSnap, hellSnap, secretSnap] = await Promise.all([
                getDocs(collection(db, "playerData", uid, "easy")),
                getDocs(collection(db, "playerData", uid, "normal")),
                getDocs(collection(db, "playerData", uid, "master")),
                getDocs(collection(db, "playerData", uid, "hell")),
                getDocs(collection(db, "playerData", uid, "secret")).catch(() => ({ empty: true, docs: [] })),
            ]);

            const listFromSnap = (snap) => {
                if (snap.empty) return [];
                return snap.docs.map((doc) => doc.data());
            };

            // Store raw data lists
            allEasyList = listFromSnap(easySnap);
            allNormalList = listFromSnap(normalSnap);
            allMasterList = listFromSnap(masterSnap);
            allHellList = listFromSnap(hellSnap);
            const secretList = listFromSnap(secretSnap);

            // Calculate and display player level and XP
            const playerData = calculatePlayerLevel(allEasyList, allNormalList, allMasterList, allHellList, secretList);
            updateLevelProgression(playerData);

            // Render all modes
            renderModeStats('easy');
            renderModeStats('normal');
            renderModeStats('master');
            renderModeStats('hell');
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


