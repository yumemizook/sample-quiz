import { getFirestore, collection, getDocs, query, where, getDocs as getDocsQuery, doc, getDoc } from "./firebase.js";
import { calculatePlayerLevel } from "./stats.js";

const db = getFirestore();

// Format relative timestamp (e.g., "2 days ago", "3 months ago")
function formatRelativeTime(timestamp) {
    if (!timestamp) return "Unknown";
    
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
    return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
}

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
const raceModeRef = collection(db, 'scoresrace');
const easyModeRef = collection(db, 'scoreseasy');
const finalModeRef = collection(db, 'scoresfinal');

// Store raw scores data for filtering
let allEasyScores = [];
let allNormalScores = [];
let allMasterScores = [];
let allRaceScores = [];
let allHellScores = [];
let allSecretScores = [];

// Current filter state
const currentFilter = {
    easy: { input: 'all', time: 'all', clear: 'all', vanish: 'all' },
    normal: { input: 'all', time: 'all', clear: 'all', vanish: 'all' },
    master: { input: 'all', time: 'all', clear: 'all', vanish: 'all' },
    race: { input: 'all', time: 'all', clear: 'all', vanish: 'all' },
    hell: { input: 'all', time: 'all', clear: 'all', vanish: 'all' }
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

// Extract unique values from scores for a specific mode
function extractUniqueValues(scores) {
    const timeMultipliers = new Set();
    const clearTypes = new Set();
    const vanishModes = new Set();
    
    scores.forEach(score => {
        // Extract time multipliers
        if (score.modifiers?.timeMultiplier !== undefined) {
            timeMultipliers.add(score.modifiers.timeMultiplier);
        }
        
        // Extract clear types
        if (score.clearType) {
            clearTypes.add(score.clearType);
        }
        
        // Extract vanish modes (fadingMode)
        const vanishMode = score.modifiers?.fadingMode;
        if (vanishMode && vanishMode !== 'off') {
            vanishModes.add(vanishMode);
        } else if (!vanishMode || vanishMode === 'off') {
            vanishModes.add('off');
        }
    });
    
    return {
        timeMultipliers: Array.from(timeMultipliers).sort((a, b) => a - b),
        clearTypes: Array.from(clearTypes).sort(),
        vanishModes: Array.from(vanishModes).sort((a, b) => {
            if (a === 'off') return -1;
            if (b === 'off') return 1;
            return parseFloat(a) - parseFloat(b);
        })
    };
}

// Populate filter dropdowns for a specific mode
function populateFilterDropdowns(mode, scores) {
    const uniqueValues = extractUniqueValues(scores);
    
    // Populate time multiplier dropdown
    const timeSelect = document.querySelector(`.time-filter-select[data-mode="${mode}"]`);
    if (timeSelect) {
        const currentValue = timeSelect.value || 'all';
        timeSelect.innerHTML = '<option value="all">All</option>';
        uniqueValues.timeMultipliers.forEach(tm => {
            const option = document.createElement('option');
            option.value = tm.toString();
            option.textContent = `${tm.toFixed(2)}x`;
            timeSelect.appendChild(option);
        });
        timeSelect.value = currentValue;
    }
    
    // Populate clear type dropdown
    const clearSelect = document.querySelector(`.clear-filter-select[data-mode="${mode}"]`);
    if (clearSelect) {
        const currentValue = clearSelect.value || 'all';
        clearSelect.innerHTML = '<option value="all">All</option>';
        uniqueValues.clearTypes.forEach(ct => {
            const option = document.createElement('option');
            option.value = ct;
            option.textContent = ct;
            clearSelect.appendChild(option);
        });
        clearSelect.value = currentValue;
    }
    
    // Populate vanish mode dropdown
    const vanishSelect = document.querySelector(`.vanish-filter-select[data-mode="${mode}"]`);
    if (vanishSelect) {
        const currentValue = vanishSelect.value || 'all';
        vanishSelect.innerHTML = '<option value="all">All</option>';
        uniqueValues.vanishModes.forEach(vm => {
            const option = document.createElement('option');
            option.value = vm;
            option.textContent = vm === 'off' ? 'Off' : `${vm}s`;
            vanishSelect.appendChild(option);
        });
        vanishSelect.value = currentValue;
    }
}

// Initialize all filter dropdowns
function initInputFilters() {
    // Input filter selects
    const inputFilterSelects = document.querySelectorAll('.input-filter-select');
    inputFilterSelects.forEach(select => {
        select.addEventListener('change', () => {
            const inputType = select.value;
            const mode = select.getAttribute('data-mode');
            
            // Update filter state
            currentFilter[mode].input = inputType;
            
            // Re-render the table for this mode
            renderTable(mode);
        });
    });
    
    // Time multiplier filter selects
    const timeFilterSelects = document.querySelectorAll('.time-filter-select');
    timeFilterSelects.forEach(select => {
        select.addEventListener('change', () => {
            const timeValue = select.value;
            const mode = select.getAttribute('data-mode');
            
            // Update filter state
            currentFilter[mode].time = timeValue;
            
            // Re-render the table for this mode
            renderTable(mode);
        });
    });
    
    // Clear type filter selects
    const clearFilterSelects = document.querySelectorAll('.clear-filter-select');
    clearFilterSelects.forEach(select => {
        select.addEventListener('change', () => {
            const clearValue = select.value;
            const mode = select.getAttribute('data-mode');
            
            // Update filter state
            currentFilter[mode].clear = clearValue;
            
            // Re-render the table for this mode
            renderTable(mode);
        });
    });
    
    // Vanish mode filter selects
    const vanishFilterSelects = document.querySelectorAll('.vanish-filter-select');
    vanishFilterSelects.forEach(select => {
        select.addEventListener('change', () => {
            const vanishValue = select.value;
            const mode = select.getAttribute('data-mode');
            
            // Update filter state
            currentFilter[mode].vanish = vanishValue;
            
            // Re-render the table for this mode
            renderTable(mode);
        });
    });
}

// Filter scores by all criteria
function filterScores(scores, filterState) {
    return scores.filter(score => {
        // Filter by input type
        if (filterState.input !== 'all' && score.inputType !== filterState.input) {
            return false;
        }
        
        // Filter by time multiplier
        if (filterState.time !== 'all') {
            const scoreTimeMultiplier = score.modifiers?.timeMultiplier;
            const filterTime = parseFloat(filterState.time);
            if (!scoreTimeMultiplier || Math.abs(scoreTimeMultiplier - filterTime) > 0.01) {
                return false;
            }
        }
        
        // Filter by clear type
        if (filterState.clear !== 'all' && score.clearType !== filterState.clear) {
            return false;
        }
        
        // Filter by vanish mode
        if (filterState.vanish !== 'all') {
            const scoreVanishMode = score.modifiers?.fadingMode;
            if (filterState.vanish === 'off') {
                // Show scores with no vanish mode or explicitly off
                if (scoreVanishMode && scoreVanishMode !== 'off') {
                    return false;
                }
            } else {
                // Show scores with matching vanish mode
                if (scoreVanishMode !== filterState.vanish) {
                    return false;
                }
            }
        }
        
        return true;
    });
}

// Render table for a specific mode
function renderTable(mode) {
    const filterState = currentFilter[mode];
    let scores = [];
    let tableId = '';
    let hasGrade = false;
    let sortFunction = null;
    
    switch(mode) {
        case 'easy':
            scores = filterScores(allEasyScores, filterState);
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
            scores = filterScores(allNormalScores, filterState);
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
            scores = filterScores(allMasterScores, filterState);
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
            scores = filterScores(allHellScores, filterState);
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
        case 'race':
            scores = filterScores(allRaceScores, filterState);
            tableId = 'scoreTable5';
            hasGrade = false; // No grades in race mode
            sortFunction = (a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score;
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
        const colspan = hasGrade ? 8 : 7;
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
        if (inputType === 'mouse') return "🖱️";
        return "❓";
    };
    
    // Format modifiers display
    const formatModifiers = (modifiers) => {
        if (!modifiers || Object.keys(modifiers).length === 0) return "";
        const parts = [];
        if (modifiers.lives) {
            parts.push(`❤️ ${modifiers.lives}`);
        }
        if (modifiers.timeMultiplier && modifiers.timeMultiplier !== 1) {
            parts.push(`⏱️ ${modifiers.timeMultiplier.toFixed(2)}x`);
        }
        if (modifiers.fadingMode) {
            parts.push(`👁️ ${modifiers.fadingMode}s`);
        }
        if (modifiers.startQuestion) {
            parts.push(`🎯 ${modifiers.startQuestion + 1}`);
        }
        return parts.length > 0 ? `<div style="font-size: 0.75em; color: #aaa; margin-top: 2px; display: flex; gap: 6px; flex-wrap: wrap;">${parts.join(' ')}</div>` : "";
    };
    
    // Render rows
    sortedScores.forEach((scoreData, index) => {
        const rank = index + 1;
        const listItem = document.createElement("tr");
        const inputTypeDisplay = formatInputType(scoreData.inputType);
        const playerName = scoreData.name || '';
        
        // Format pause count display
        const pauseCount = scoreData.pauseCount || 0;
        const pauseDisplay = pauseCount > 0 ? `<div style="font-size: 0.8em; color: #888; margin-top: 2px;">Pauses: ${pauseCount}</div>` : '';
        
        // Format modifiers display
        const modifiersDisplay = formatModifiers(scoreData.modifiers);
        
        // Format clear type display
        const clearTypeDisplay = scoreData.clearType ? `<span style="color: #4CAF50; font-weight: bold;">${scoreData.clearType}</span>` : '';
        
        if (hasGrade) {
            const gradeDisplay = scoreData.grade 
                ? `<span class="grade-badge" style="color: ${getLineColor(scoreData)}">${formatGrade(scoreData.grade)}</span>` 
                : "-";
            listItem.innerHTML = `
                <td>${rank}</td>
                <td><span class="player-name-hover" data-player-name="${playerName}">${playerName}</span></td>
                <td class="high-score">${scoreData.score}${modifiersDisplay}</td>
                <td>${gradeDisplay}</td>
                <td>${scoreData.time}${pauseDisplay}</td>
                <td>${clearTypeDisplay || "-"}</td>
                <td>${inputTypeDisplay}</td>
                <td>${scoreData.date}</td>
            `;
        } else {
            listItem.innerHTML = `
                <td>${rank}</td>
                <td><span class="player-name-hover" data-player-name="${playerName}">${playerName}</span></td>
                <td class="high-score">${scoreData.score}${modifiersDisplay}</td>
                <td>${scoreData.time}${pauseDisplay}</td>
                <td>${clearTypeDisplay || "-"}</td>
                <td>${inputTypeDisplay}</td>
                <td>${scoreData.date}</td>
            `;
        }
        newTbody.appendChild(listItem);
    });
    
    // Attach hover event listeners to player names
    attachPlayerNameHovers();
}

// Parse time string to milliseconds
function parseTime(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
}

// Profile popup functionality
let profilePopup = null;
let profilePopupTimeout = null;

// Create profile popup element
function createProfilePopup() {
    if (profilePopup) return profilePopup;
    
    profilePopup = document.createElement('div');
    profilePopup.id = 'playerProfilePopup';
    profilePopup.className = 'player-profile-popup';
    profilePopup.style.cursor = 'pointer';
    profilePopup.innerHTML = `
        <div class="profile-popup-banner"></div>
        <div class="profile-popup-content">
            <div class="profile-popup-avatar-container">
                <img class="profile-popup-avatar" src="" alt="Avatar">
                <div class="profile-popup-avatar-placeholder">👤</div>
            </div>
            <div class="profile-popup-info">
                <h3 class="profile-popup-name"></h3>
                <div class="profile-popup-level">
                    <span class="profile-popup-badge"></span>
                    <span class="profile-popup-level-text"></span>
                </div>
                <div class="profile-popup-created" style="margin-top: 8px; font-size: 0.85em; color: rgba(255, 255, 255, 0.7);">
                    <span class="profile-popup-created-text"></span>
                </div>
            </div>
            <div class="profile-popup-scores">
                <h4>Best Scores</h4>
                <div class="profile-popup-score-item">
                    <span class="score-mode">Easy:</span>
                    <span class="score-value">-</span>
                </div>
                <div class="profile-popup-score-item">
                    <span class="score-mode">Normal:</span>
                    <span class="score-value">-</span>
                </div>
                <div class="profile-popup-score-item">
                    <span class="score-mode">Master:</span>
                    <span class="score-value">-</span>
                </div>
                <div class="profile-popup-score-item">
                    <span class="score-mode">Race:</span>
                    <span class="score-value">-</span>
                </div>
                <div class="profile-popup-score-item">
                    <span class="score-mode">Hell:</span>
                    <span class="score-value">-</span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(profilePopup);
    return profilePopup;
}

// Get badge emoji and name (matching hm.js logic)
function getBadgeForLevel(level) {
    if (level >= 1000) return "🌠"; // Meteor (Lv 1000+)
    if (level >= 900) return "🌙"; // Moon (Lv 900-999)
    if (level >= 800) return "☀️"; // Sun (Lv 800-899)
    if (level >= 700) return "🌍"; // Earth (Lv 700-799)
    if (level >= 600) return "🪐"; // Planet (Lv 600-699)
    if (level >= 500) return "⭐"; // Star (Lv 500-599)
    if (level >= 400) return "🌟"; // Glowing Star (Lv 400-499)
    if (level >= 300) return "💫"; // Dizzy Star (Lv 300-399)
    if (level >= 250) return "🌌"; // Galaxy (Lv 250-299)
    if (level >= 200) return "🌠"; // Shooting Star (Lv 200-249)
    if (level >= 150) return "⚛️"; // Atomic (Lv 150-199)
    if (level >= 120) return "🔮"; // Crystal (Lv 120-149)
    if (level >= 100) return "✨"; // Sparkle (Lv 100-119)
    if (level >= 80) return "🏆"; // Champion (Lv 80-99)
    if (level >= 70) return "👑"; // Royal (Lv 70-79)
    if (level >= 60) return "💎"; // Diamond (Lv 60-69)
    if (level >= 50) return "⭐"; // Star (Lv 50-59)
    if (level >= 40) return "🔥"; // Fire (Lv 40-49)
    if (level >= 35) return "⚡"; // Lightning (Lv 35-39)
    if (level >= 30) return "🌟"; // Shining Star (Lv 30-34)
    if (level >= 25) return "🎯"; // Target (Lv 25-29)
    if (level >= 20) return "🎖️"; // Medal (Lv 20-24)
    if (level >= 15) return "🏅"; // Trophy (Lv 15-19)
    if (level >= 12) return "🥇"; // Gold Medal (Lv 12-14)
    if (level >= 9) return "🥈"; // Silver Medal (Lv 9-11)
    if (level >= 6) return "🥉"; // Bronze Medal (Lv 6-8)
    if (level >= 3) return "⭐"; // Star (Lv 3-5)
    return "🌱"; // Sprout (Lv 1-2)
}

function getBadgeName(level) {
    if (level >= 1000) return "Meteor";
    if (level >= 900) return "Moon";
    if (level >= 800) return "Sun";
    if (level >= 700) return "Earth";
    if (level >= 600) return "Planet";
    if (level >= 500) return "Star";
    if (level >= 400) return "Glowing Star";
    if (level >= 300) return "Dizzy Star";
    if (level >= 250) return "Galaxy";
    if (level >= 200) return "Shooting Star";
    if (level >= 150) return "Atomic";
    if (level >= 120) return "Crystal";
    if (level >= 100) return "Sparkle";
    if (level >= 80) return "Champion";
    if (level >= 70) return "Royal";
    if (level >= 60) return "Diamond";
    if (level >= 50) return "Star";
    if (level >= 40) return "Fire";
    if (level >= 35) return "Lightning";
    if (level >= 30) return "Shining Star";
    if (level >= 25) return "Target";
    if (level >= 20) return "Medal";
    if (level >= 15) return "Trophy";
    if (level >= 12) return "Gold Medal";
    if (level >= 9) return "Silver Medal";
    if (level >= 6) return "Bronze Medal";
    if (level >= 3) return "Star";
    return "Sprout";
}

// calculatePlayerLevel is now imported from stats.js to ensure synchronization

// Find best scores for each mode
function findBestScores(playerName) {
    const bestScores = {
        easy: null,
        normal: null,
        master: null,
        race: null,
        hell: null
    };
    
    // Find best easy score
    const easyPlayerScores = allEasyScores.filter(s => s.name === playerName);
    if (easyPlayerScores.length > 0) {
        easyPlayerScores.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            return parseTime(a.time) - parseTime(b.time);
        });
        bestScores.easy = easyPlayerScores[0];
    }
    
    // Find best normal score
    const normalPlayerScores = allNormalScores.filter(s => s.name === playerName);
    if (normalPlayerScores.length > 0) {
        normalPlayerScores.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            if (a.grade && b.grade && a.grade !== b.grade) {
                return b.grade.localeCompare(a.grade);
            }
            return parseTime(a.time) - parseTime(b.time);
        });
        bestScores.normal = normalPlayerScores[0];
    }
    
    // Find best master score
    const masterPlayerScores = allMasterScores.filter(s => s.name === playerName);
    if (masterPlayerScores.length > 0) {
        masterPlayerScores.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            if (a.grade && b.grade && a.grade !== b.grade) {
                const gradeOrder = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "GM", "Grand Master"];
                const index1 = gradeOrder.indexOf(a.grade);
                const index2 = gradeOrder.indexOf(b.grade);
                if (index1 !== -1 && index2 !== -1) {
                    const gradeComp = index1 - index2;
                    if (gradeComp !== 0) return -gradeComp;
                }
            }
            return parseTime(a.time) - parseTime(b.time);
        });
        bestScores.master = masterPlayerScores[0];
    }
    
    // Find best race score
    const racePlayerScores = allRaceScores.filter(s => s.name === playerName);
    if (racePlayerScores.length > 0) {
        racePlayerScores.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            return parseTime(a.time) - parseTime(b.time);
        });
        bestScores.race = racePlayerScores[0];
    }
    
    // Find best hell score
    const hellPlayerScores = allHellScores.filter(s => s.name === playerName);
    if (hellPlayerScores.length > 0) {
        hellPlayerScores.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            if (a.grade && b.grade && a.grade !== b.grade) {
                if (a.grade === "Grand Master - Infinity") return -1;
                if (b.grade === "Grand Master - Infinity") return 1;
                if (a.grade.startsWith("S") && b.grade.startsWith("S")) {
                    const num1 = parseInt(a.grade.substring(1)) || 0;
                    const num2 = parseInt(b.grade.substring(1)) || 0;
                    return num2 - num1;
                }
                return b.grade.localeCompare(a.grade);
            }
            return parseTime(a.time) - parseTime(b.time);
        });
        bestScores.hell = hellPlayerScores[0];
    }
    
    return bestScores;
}

// Load and display player profile
async function loadPlayerProfile(playerName) {
    if (!playerName) return;
    
    const popup = createProfilePopup();
    
    // Reset avatar to placeholder initially
    const avatarImg = popup.querySelector('.profile-popup-avatar');
    const avatarPlaceholder = popup.querySelector('.profile-popup-avatar-placeholder');
    avatarImg.classList.remove('show');
    avatarPlaceholder.classList.remove('hide');
    avatarImg.src = ''; // Clear any previous image
    
    // Set player name
    popup.querySelector('.profile-popup-name').textContent = playerName;
    
    // First, check userProfiles database to see if player exists
    try {
        // Query userProfiles to find user by displayName or email
        const userProfilesRef = collection(db, 'userProfiles');
        const userProfilesSnapshot = await getDocs(userProfilesRef);
        
        let foundUser = null;
        const isEmail = playerName.includes('@');
        
        userProfilesSnapshot.forEach(doc => {
            const data = doc.data();
            // Check if this user's displayName or email matches
            if (data.displayName === playerName || 
                (isEmail && data.email === playerName) ||
                (isEmail && playerName === data.displayName)) {
                foundUser = { uid: doc.id, ...data };
            }
        });
        
        // If not found by displayName/email, try to find by matching the name in scores
        // The name in scores could be either displayName or email from Firebase Auth
        if (!foundUser) {
            // Try to find user by checking if playerName matches any user's email or displayName
            userProfilesSnapshot.forEach(doc => {
                const data = doc.data();
                // Check if playerName matches email (if stored) or displayName
                if ((data.email && data.email === playerName) || 
                    (data.displayName && data.displayName === playerName)) {
                    foundUser = { uid: doc.id, ...data };
                }
            });
        }
        
        // If player not found in userProfiles, show "Player not found" message
        if (!foundUser) {
            const badgeEl = popup.querySelector('.profile-popup-badge');
            const levelTextEl = popup.querySelector('.profile-popup-level-text');
            const createdTextEl = popup.querySelector('.profile-popup-created-text');
            badgeEl.textContent = '❓';
            levelTextEl.textContent = 'Player not found';
            if (createdTextEl) {
                createdTextEl.textContent = 'This player does not exist in the database';
            }
            
            // Hide avatar container
            const avatarContainer = popup.querySelector('.profile-popup-avatar-container');
            if (avatarContainer) {
                avatarContainer.style.display = 'none';
            }
            
            // Hide banner
            const bannerEl = popup.querySelector('.profile-popup-banner');
            if (bannerEl) {
                bannerEl.style.display = 'none';
            }
            
            // Hide scores section
            const scoresSection = popup.querySelector('.profile-popup-scores');
            if (scoresSection) {
                scoresSection.style.display = 'none';
            }
            
            // Adjust info margin since avatar is hidden
            const infoEl = popup.querySelector('.profile-popup-info');
            if (infoEl) {
                infoEl.style.marginTop = '20px';
            }
            
            return;
        }
        
        // Player found in userProfiles - load their profile and scores
        // Display account creation timestamp
        const createdTextEl = popup.querySelector('.profile-popup-created-text');
        if (createdTextEl && foundUser.createdAt) {
            createdTextEl.textContent = `Joined ${formatRelativeTime(foundUser.createdAt)}`;
        } else if (createdTextEl) {
            createdTextEl.textContent = '';
        }
        
        // Load avatar
        const avatarURL = foundUser.photoURL || foundUser.avatarURL;
        if (avatarURL) {
            // Set up image loading with error handling
            avatarImg.onload = () => {
                avatarImg.classList.add('show');
                avatarPlaceholder.classList.add('hide');
            };
            avatarImg.onerror = () => {
                // If image fails to load, show placeholder
                avatarImg.classList.remove('show');
                avatarPlaceholder.classList.remove('hide');
                avatarImg.src = ''; // Clear failed src
            };
            avatarImg.src = avatarURL;
        } else {
            avatarImg.classList.remove('show');
            avatarPlaceholder.classList.remove('hide');
            avatarImg.src = ''; // Clear src if no URL
        }
        
        // Show avatar container (it might have been hidden previously)
        const avatarContainer = popup.querySelector('.profile-popup-avatar-container');
        if (avatarContainer) {
            avatarContainer.style.display = '';
        }
        
        // Show scores section (it might have been hidden previously)
        const scoresSection = popup.querySelector('.profile-popup-scores');
        if (scoresSection) {
            scoresSection.style.display = '';
        }
        
        // Load banner
        const bannerEl = popup.querySelector('.profile-popup-banner');
        const infoEl = popup.querySelector('.profile-popup-info');
        if (foundUser.bannerURL) {
            bannerEl.style.backgroundImage = `url(${foundUser.bannerURL})`;
            bannerEl.style.display = 'block';
            // Reset avatar position when banner is shown
            if (avatarContainer) {
                avatarContainer.style.top = '-50px';
            }
            // Reset info margin when banner is shown
            if (infoEl) {
                infoEl.style.marginTop = '60px';
            }
        } else {
            bannerEl.style.display = 'none';
            // Move avatar down when no banner
            if (avatarContainer) {
                avatarContainer.style.top = '20px';
            }
            // Shift info down when no banner (avatar is at 20px, height 100px, so bottom at 120px, add 10px gap = 130px)
            if (infoEl) {
                infoEl.style.marginTop = '130px';
            }
        }
        
        // Find best scores
        const bestScores = findBestScores(playerName);
        
        // Calculate level from scores using the same formula as navbar and stats
        const easyScores = allEasyScores.filter(s => s.name === playerName);
        const normalScores = allNormalScores.filter(s => s.name === playerName);
        const masterScores = allMasterScores.filter(s => s.name === playerName);
        const raceScores = allRaceScores.filter(s => s.name === playerName);
        const hellScores = allHellScores.filter(s => s.name === playerName);
        
        // Secret scores are not fetched for player profile tooltip
        const secretScores = [];
        
        const playerData = calculatePlayerLevel(easyScores, normalScores, masterScores, hellScores, secretScores, raceScores);
        const badge = getBadgeForLevel(playerData.level);
        const badgeName = getBadgeName(playerData.level);
        
        // Update level display
        const badgeEl = popup.querySelector('.profile-popup-badge');
        const levelTextEl = popup.querySelector('.profile-popup-level-text');
        badgeEl.textContent = badge;
        levelTextEl.textContent = `Lv. ${playerData.level} (${badgeName})`;
        
        // Update best scores
        const updateScore = (mode, scoreData) => {
            const scoreItem = popup.querySelector(`.profile-popup-score-item:nth-child(${['easy', 'normal', 'master', 'race', 'hell'].indexOf(mode) + 2})`);
            if (scoreItem) {
                const scoreValue = scoreItem.querySelector('.score-value');
                if (scoreData) {
                    if (mode === 'race') {
                        // Race mode: show best time if completed (GM grade), otherwise show best score
                        const isCompleted = scoreData.grade === "GM";
                        if (isCompleted && scoreData.time) {
                            scoreValue.textContent = scoreData.time;
                        } else {
                            scoreValue.textContent = scoreData.score.toLocaleString();
                        }
                    } else if (mode === 'normal' || mode === 'master' || mode === 'hell') {
                        const grade = scoreData.grade ? ` - ${scoreData.grade}` : '';
                        scoreValue.textContent = `${scoreData.score}${grade}`;
                    } else {
                        scoreValue.textContent = scoreData.score;
                    }
                } else {
                    scoreValue.textContent = 'No score';
                }
            }
        };
        
        updateScore('easy', bestScores.easy);
        updateScore('normal', bestScores.normal);
        updateScore('master', bestScores.master);
        updateScore('race', bestScores.race);
        updateScore('hell', bestScores.hell);
        
    } catch (error) {
        console.error('Error loading player profile:', error);
        // On error, show "Player not found" message
        const badgeEl = popup.querySelector('.profile-popup-badge');
        const levelTextEl = popup.querySelector('.profile-popup-level-text');
        const createdTextEl = popup.querySelector('.profile-popup-created-text');
        badgeEl.textContent = '❓';
        levelTextEl.textContent = 'Player not found';
        if (createdTextEl) {
            createdTextEl.textContent = 'Error loading player profile';
        }
        
        // Hide avatar container
        const avatarContainer = popup.querySelector('.profile-popup-avatar-container');
        if (avatarContainer) {
            avatarContainer.style.display = 'none';
        }
        
        // Hide banner
        const bannerEl = popup.querySelector('.profile-popup-banner');
        if (bannerEl) {
            bannerEl.style.display = 'none';
        }
        
        // Hide scores section
        const scoresSection = popup.querySelector('.profile-popup-scores');
        if (scoresSection) {
            scoresSection.style.display = 'none';
        }
        
        // Adjust info margin since avatar is hidden
        const infoEl = popup.querySelector('.profile-popup-info');
        if (infoEl) {
            infoEl.style.marginTop = '20px';
        }
    }
}

// Attach hover event listeners to player names
function attachPlayerNameHovers() {
    const playerNames = document.querySelectorAll('.player-name-hover');
    
    playerNames.forEach(nameEl => {
        const playerName = nameEl.getAttribute('data-player-name');
        
        // Make name clickable to redirect to profile page
        nameEl.style.cursor = 'pointer';
        nameEl.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `profile.html?player=${encodeURIComponent(playerName)}`;
        });
        
        nameEl.addEventListener('mouseenter', () => {
            if (profilePopupTimeout) {
                clearTimeout(profilePopupTimeout);
            }
            
            profilePopupTimeout = setTimeout(async () => {
                const popup = createProfilePopup();
                await loadPlayerProfile(playerName);
                
                // Add click handler to navigate to profile page
                popup.onclick = (e) => {
                    e.stopPropagation();
                    window.location.href = `profile.html?player=${encodeURIComponent(playerName)}`;
                };
                
                popup.style.display = 'block';
                positionPopup(popup, nameEl);
            }, 300); // Small delay to prevent accidental hovers
        });
        
        nameEl.addEventListener('mouseleave', () => {
            if (profilePopupTimeout) {
                clearTimeout(profilePopupTimeout);
            }
            
            const popup = document.getElementById('playerProfilePopup');
            if (popup) {
                // Keep popup visible when hovering over it
                const handlePopupEnter = () => {
                    if (profilePopupTimeout) clearTimeout(profilePopupTimeout);
                };
                
                const handlePopupLeave = () => {
                    profilePopupTimeout = setTimeout(() => {
                        if (popup) {
                            popup.style.display = 'none';
                        }
                    }, 200);
                };
                
                // Remove old listeners and add new ones
                popup.removeEventListener('mouseenter', handlePopupEnter);
                popup.removeEventListener('mouseleave', handlePopupLeave);
                popup.addEventListener('mouseenter', handlePopupEnter);
                popup.addEventListener('mouseleave', handlePopupLeave);
                
                profilePopupTimeout = setTimeout(() => {
                    if (popup && !popup.matches(':hover')) {
                        popup.style.display = 'none';
                    }
                }, 200);
            }
        });
    });
}

// Position popup near the hovered element
function positionPopup(popup, targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // On mobile, center the popup on screen
        const left = (window.innerWidth - popupRect.width) / 2;
        const top = Math.max(10, (window.innerHeight - popupRect.height) / 2);
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    } else {
        // Desktop positioning - raise tooltip up
        let left = rect.right + 15;
        // Position above the element instead of at its top
        let top = rect.top - popupRect.height - 10;
        
        // Adjust if popup would go off screen to the right
        if (left + popupRect.width > window.innerWidth) {
            left = rect.left - popupRect.width - 15;
        }
        
        // If popup would go off screen above, position below instead
        if (top < 10) {
            top = rect.bottom + 10;
        }
        
        // If popup would go off screen at the bottom, adjust to fit
        if (top + popupRect.height > window.innerHeight) {
            top = window.innerHeight - popupRect.height - 10;
        }
        
        // Final check to ensure it's not too high
        if (top < 10) {
            top = 10;
        }
        
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // Ensure leaderboard container is always visible (even when logged out)
    const container2 = document.querySelector('.container2');
    if (container2) {
        // Remove any hide class and ensure display is not none
        container2.classList.remove('hide');
        container2.style.display = 'flex';
        container2.style.visibility = 'visible';
    }
    
    // Initialize tabs
    initTabs();
    
    // Initialize input filters and set all to "All" filter
    initInputFilters();
    
    // Ensure all dropdowns default to "All" on page load (already set in HTML, but ensure consistency)
    const allInputSelects = document.querySelectorAll('.input-filter-select');
    allInputSelects.forEach(select => {
        if (select.value !== 'all') select.value = 'all';
    });
    const allTimeSelects = document.querySelectorAll('.time-filter-select');
    allTimeSelects.forEach(select => {
        if (select.value !== 'all') select.value = 'all';
    });
    const allClearSelects = document.querySelectorAll('.clear-filter-select');
    allClearSelects.forEach(select => {
        if (select.value !== 'all') select.value = 'all';
    });
    const allVanishSelects = document.querySelectorAll('.vanish-filter-select');
    allVanishSelects.forEach(select => {
        if (select.value !== 'all') select.value = 'all';
    });
    
    // Automatically fetch and display scores on page load
    try {
        console.log("Fetching scores from Firebase...");
        
        // Fetch all score collections in parallel for better performance
        const [snapshot, masterSnapshot, raceSnapshot, easySnapshot, finalSnapshot] = await Promise.all([
            getDocs(highScoresRef),
            getDocs(masterModeRef),
            getDocs(raceModeRef),
            getDocs(easyModeRef),
            getDocs(finalModeRef)
        ]);
        
        // Store raw scores
        allNormalScores = snapshot.empty ? [] : snapshot.docs.map((doc) => doc.data());
        allEasyScores = easySnapshot.empty ? [] : easySnapshot.docs.map((doc) => doc.data());
        allMasterScores = masterSnapshot.empty ? [] : masterSnapshot.docs.map((doc) => doc.data());
        allRaceScores = raceSnapshot.empty ? [] : raceSnapshot.docs.map((doc) => doc.data());
        allHellScores = finalSnapshot.empty ? [] : finalSnapshot.docs.map((doc) => doc.data());
        
        console.log(`Loaded scores: Easy=${allEasyScores.length}, Normal=${allNormalScores.length}, Master=${allMasterScores.length}, Race=${allRaceScores.length}, Hell=${allHellScores.length}`);
        
        // Load secret scores (for level calculation, but not displayed in rankings)
        // Secret scores are stored per-user, so we need to fetch from all users' playerData
        allSecretScores = []; // Initialize as empty array
        // Note: Secret scores are not displayed in rankings, but are needed for accurate level calculation
        // We'll fetch them on-demand when loading a player profile
        
        // Populate filter dropdowns with unique values from database
        populateFilterDropdowns('easy', allEasyScores);
        populateFilterDropdowns('normal', allNormalScores);
        populateFilterDropdowns('master', allMasterScores);
        populateFilterDropdowns('race', allRaceScores);
        populateFilterDropdowns('hell', allHellScores);
        
        // Render all tables automatically
        renderTable('easy');
        renderTable('normal');
        renderTable('master');
        renderTable('race');
        renderTable('hell');
        
        console.log("Scores displayed successfully");
    } catch (error) {
        console.error("Error fetching high scores:", error);
        // Display error message to user
        const container2 = document.querySelector('.container2');
        if (container2) {
            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = 'color: red; padding: 20px; text-align: center; background: rgba(0,0,0,0.8); border-radius: 10px; margin: 20px;';
            errorMsg.textContent = 'Failed to load scores. Please refresh the page.';
            container2.insertBefore(errorMsg, container2.firstChild);
        }
    }
});
