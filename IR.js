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

// Store raw scores data for filtering
let allEasyScores = [];
let allNormalScores = [];
let allMasterScores = [];
let allHellScores = [];

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
            
            // Re-render the table for this mode
            renderTable(mode);
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

// Render table for a specific mode
function renderTable(mode) {
    const filterType = currentFilter[mode];
    let scores = [];
    let tableId = '';
    let hasGrade = false;
    let sortFunction = null;
    
    switch(mode) {
        case 'easy':
            scores = filterScores(allEasyScores, filterType);
            tableId = 'scoreTable';
            hasGrade = false;
            sortFunction = (a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                return parseTime(a.time) - parseTime(b.time);
            };
            break;
        case 'normal':
            scores = filterScores(allNormalScores, filterType);
            tableId = 'scoreTable2';
            hasGrade = true;
            sortFunction = (a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                if (a.grade && b.grade && a.grade !== b.grade) {
                    const gradeComp = b.grade.localeCompare(a.grade);
                    if (gradeComp !== 0) return gradeComp;
                }
                if (a.grade && b.grade && a.grade === b.grade) {
                    const lineComp = compareLineColors(a.line || "white", b.line || "white");
                    if (lineComp !== 0) return -lineComp;
                }
                return parseTime(a.time) - parseTime(b.time);
            };
            break;
        case 'master':
            scores = filterScores(allMasterScores, filterType);
            tableId = 'scoreTable3';
            hasGrade = true;
            sortFunction = (a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                if (a.grade && b.grade && a.grade !== b.grade) {
                    const gradeOrder = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "GM", "Grand Master"];
                    const index1 = gradeOrder.indexOf(a.grade);
                    const index2 = gradeOrder.indexOf(b.grade);
                    if (index1 !== -1 && index2 !== -1) {
                        const gradeComp = index1 - index2;
                        if (gradeComp !== 0) return -gradeComp;
                    }
                }
                if (a.grade && b.grade && a.grade === b.grade) {
                    const lineComp = compareLineColors(a.line || "white", b.line || "white");
                    if (lineComp !== 0) return -lineComp;
                }
                return parseTime(a.time) - parseTime(b.time);
            };
            break;
        case 'hell':
            scores = filterScores(allHellScores, filterType);
            tableId = 'scoreTable4';
            hasGrade = true;
            sortFunction = (a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                if (a.grade && b.grade && a.grade !== b.grade) {
                    if (a.grade === "Grand Master - Infinity") return -1;
                    if (b.grade === "Grand Master - Infinity") return 1;
                    if (a.grade.startsWith("S") && b.grade.startsWith("S")) {
                        const num1 = parseInt(a.grade.substring(1)) || 0;
                        const num2 = parseInt(b.grade.substring(1)) || 0;
                        const gradeComp = num1 - num2;
                        if (gradeComp !== 0) return -gradeComp;
                    } else {
                        const gradeComp = b.grade.localeCompare(a.grade);
                        if (gradeComp !== 0) return gradeComp;
                    }
                }
                if (a.grade && b.grade && a.grade === b.grade) {
                    const lineComp = compareLineColors(a.line || "white", b.line || "white");
                    if (lineComp !== 0) return -lineComp;
                }
                return parseTime(a.time) - parseTime(b.time);
            };
            break;
    }
    
    const table = document.querySelector(`#${tableId}`);
    if (!table) return;
    
    // Clear existing rows
    const tbody = table.querySelector("tbody");
    if (tbody) {
        tbody.remove();
    }
    const newTbody = document.createElement("tbody");
    table.appendChild(newTbody);
    
    if (scores.length === 0) {
        const colspan = hasGrade ? 7 : 6;
        newTbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.7);">No scores available yet</td></tr>`;
        return;
    }
    
    // Sort scores
    const sortedScores = scores.sort(sortFunction);
    
    // Format grade helper
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
        return "#ffffff";
    };
    
    // Format input type with icon
    const formatInputType = (inputType) => {
        if (!inputType || inputType === 'unknown') return "❓";
        if (inputType === 'controller') return "🎮";
        if (inputType === 'keyboard') return "⌨️";
        if (inputType === 'mobile') return "📱";
        return "❓";
    };
    
    // Render rows
    sortedScores.forEach((scoreData, index) => {
        const rank = index + 1;
        const listItem = document.createElement("tr");
        const inputTypeDisplay = formatInputType(scoreData.inputType);
        
        if (hasGrade) {
            const gradeDisplay = scoreData.grade 
                ? `<span class="grade-badge" style="color: ${getLineColor(scoreData)}">${formatGrade(scoreData.grade)}</span>` 
                : "-";
            listItem.innerHTML = `
                <td>${rank}</td>
                <td>${scoreData.name}</td>
                <td class="high-score">${scoreData.score}</td>
                <td>${gradeDisplay}</td>
                <td>${scoreData.time}</td>
                <td>${inputTypeDisplay}</td>
                <td>${scoreData.date}</td>
            `;
        } else {
            listItem.innerHTML = `
                <td>${rank}</td>
                <td>${scoreData.name}</td>
                <td class="high-score">${scoreData.score}</td>
                <td>${scoreData.time}</td>
                <td>${inputTypeDisplay}</td>
                <td>${scoreData.date}</td>
            `;
        }
        newTbody.appendChild(listItem);
    });
}

// Parse time string to milliseconds
function parseTime(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
}

document.addEventListener("DOMContentLoaded", async () => {
    // Initialize tabs
    initTabs();
    
    // Initialize input filters
    initInputFilters();
    
    try {
        const snapshot = await getDocs(highScoresRef);
        const masterSnapshot = await getDocs(masterModeRef);
        const easySnapshot = await getDocs(easyModeRef);
        const finalSnapshot = await getDocs(finalModeRef);
        
        // Store raw scores
        allNormalScores = snapshot.empty ? [] : snapshot.docs.map((doc) => doc.data());
        allEasyScores = easySnapshot.empty ? [] : easySnapshot.docs.map((doc) => doc.data());
        allMasterScores = masterSnapshot.empty ? [] : masterSnapshot.docs.map((doc) => doc.data());
        allHellScores = finalSnapshot.empty ? [] : finalSnapshot.docs.map((doc) => doc.data());
        
        // Render all tables
        renderTable('easy');
        renderTable('normal');
        renderTable('master');
        renderTable('hell');
    } catch (error) {
        console.error("Error fetching high scores:", error);
    }
});
