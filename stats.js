import { getAuth, getFirestore, collection, getDocs, onAuthStateChanged, doc, getDoc } from "./firebase.js";

const auth = getAuth();
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

// Calculate main input method based on play counts
function calculateMainInputMethod(easyScores, normalScores, masterScores, hellScores, secretScores, raceScores = []) {
    const inputCounts = {
        keyboard: 0,
        controller: 0,
        mobile: 0,
        mouse: 0,
        unknown: 0
    };
    
    // Count input types across all modes
    const allScores = [...easyScores, ...normalScores, ...masterScores, ...hellScores, ...secretScores, ...raceScores];
    allScores.forEach(score => {
        const inputType = (score.inputType || "unknown").toLowerCase();
        if (inputType === "keyboard" || inputType === "⌨️") {
            inputCounts.keyboard++;
        } else if (inputType === "controller" || inputType === "🎮") {
            inputCounts.controller++;
        } else if (inputType === "mobile" || inputType === "📱") {
            inputCounts.mobile++;
        } else if (inputType === "mouse" || inputType === "🖱️") {
            inputCounts.mouse++;
        } else {
            inputCounts.unknown++;
        }
    });
    
    // Determine main input method (highest count)
    let mainInput = "unknown";
    let maxCount = inputCounts.unknown;
    
    if (inputCounts.keyboard > maxCount) {
        mainInput = "keyboard";
        maxCount = inputCounts.keyboard;
    }
    if (inputCounts.controller > maxCount) {
        mainInput = "controller";
        maxCount = inputCounts.controller;
    }
    if (inputCounts.mobile > maxCount) {
        mainInput = "mobile";
        maxCount = inputCounts.mobile;
    }
    if (inputCounts.mouse > maxCount) {
        mainInput = "mouse";
        maxCount = inputCounts.mouse;
    }
    
    // Format with icon
    const icons = {
        keyboard: "⌨️",
        controller: "🎮",
        mobile: "📱",
        mouse: "🖱️",
        unknown: "❓"
    };
    
    const names = {
        keyboard: "Keyboard",
        controller: "Controller",
        mobile: "Mobile",
        mouse: "Mouse",
        unknown: "Unknown"
    };
    
    return {
        method: mainInput,
        icon: icons[mainInput],
        name: names[mainInput],
        count: maxCount,
        total: allScores.length
    };
}

// Calculate player level and XP based on achievements and grade points
function calculatePlayerLevel(easyScores, normalScores, masterScores, hellScores, secretScores, raceScores = []) {
    let experience = 0;
    
    // Base XP from scores earned (scaled appropriately for each mode)
    // Easy mode: score field contains totalGradePoints
    easyScores.forEach(score => {
        const gradePoints = score.score || 0; // In easy mode, score is grade points
        experience += Math.floor(gradePoints / 500); // 1 XP per 500 grade points
        
        // Clear type bonuses (excluding Failed and Clear/Normal)
        if (score.clearType && score.clearType !== "Failed" && score.clearType !== "Clear") {
            if (score.clearType === "Hard") experience += 25;
            else if (score.clearType === "Brave") experience += 50;
            else if (score.clearType === "Absolute") experience += 75;
            else if (score.clearType === "Catastrophy") experience += 100;
            else if (score.clearType === "All Correct!") experience += 150;
        }
    });
    
    // Normal mode: score field contains correct answers (0-150)
    normalScores.forEach(score => {
        const correctAnswers = score.score || 0;
        // Award XP based on questions answered (more questions = more XP)
        experience += Math.floor(correctAnswers * 0.5); // 0.5 XP per question
        
        // Milestone bonuses
        if (correctAnswers >= 100) experience += 25;
        else if (correctAnswers >= 75) experience += 15;
        else if (correctAnswers >= 50) experience += 10;
        else if (correctAnswers >= 25) experience += 5;
        
        // Clear type bonuses (excluding Failed and Clear/Normal)
        if (score.clearType && score.clearType !== "Failed" && score.clearType !== "Clear") {
            if (score.clearType === "Hard") experience += 25;
            else if (score.clearType === "Brave") experience += 50;
            else if (score.clearType === "Absolute") experience += 75;
            else if (score.clearType === "Catastrophy") experience += 100;
            else if (score.clearType === "All Correct!") experience += 150;
        }
    });
    
    // Master mode: score field contains totalGradePoints
    masterScores.forEach(score => {
        const gradePoints = score.score || 0;
        experience += Math.floor(gradePoints / 100); // 1 XP per 100 grade points
        
        // Bonus XP for grades
        if (score.grade === "GM") {
            experience += 200; // Grand Master bonus
        } else if (score.grade && score.grade.startsWith("S")) {
            const sLevel = parseInt(score.grade.substring(1)) || 0;
            experience += sLevel * 10; // S1 = +5, S9 = +45
        }
        
        // Line color bonuses
        if (score.grade === "GM" && score.line === "orange") {
            experience += 150;
        } else if (score.grade === "GM" && score.line === "green") {
        experience += 50;
        } 
        if (score.line === "orange") {experience += 50;}
        else if (score.line === "green") {experience += 25;}
        
        // Clear type bonuses (excluding Failed and Clear/Normal)
        if (score.clearType && score.clearType !== "Failed" && score.clearType !== "Clear") {
            if (score.clearType === "Hard") experience += 25;
            else if (score.clearType === "Brave") experience += 50;
            else if (score.clearType === "Absolute") experience += 75;
            else if (score.clearType === "Catastrophy") experience += 100;
            else if (score.clearType === "All Correct!") experience += 150;
        }
    });
    
    // Hell mode: score field contains correct answers (0-200)
    hellScores.forEach(score => {
        const correctAnswers = score.score || 0;
        experience += Math.floor(correctAnswers * 8); // 8 XP per question completed
        
        // Grade bonuses (significant rewards for hell mode achievements)
        if (score.grade === "Grand Master - Infinity") {
            experience += 200;
        } else if (score.grade && score.grade.startsWith("S")) {
            const sLevel = parseInt(score.grade.substring(1)) || 0;
            experience += sLevel * 10; // S1 = +10, S20 = +200
        }
        
        // Clear type bonuses (excluding Failed and Clear/Normal)
        if (score.clearType && score.clearType !== "Failed" && score.clearType !== "Clear") {
            if (score.clearType === "Hard") experience += 25;
            else if (score.clearType === "Brave") experience += 50;
            else if (score.clearType === "Absolute") experience += 75;
            else if (score.clearType === "Catastrophy") experience += 100;
            else if (score.clearType === "All Correct!") experience += 150;
        }
    });
    
    // Race mode: gradePoints field contains totalGradePoints
    raceScores.forEach(score => {
        const gradePoints = score.gradePoints || score.score || 0; // Use gradePoints if available, fallback to score for backwards compatibility
        experience += Math.floor(gradePoints / 120); // 1 XP per 120 grade points (slightly less than master)
        
        // Bonus XP for GM grade
        if (score.grade === "GM") {
            experience += 250; // Higher bonus for race mode GM (harder to achieve)
        }
        
        // Clear type bonuses (excluding Failed and Clear/Normal)
        if (score.clearType && score.clearType !== "Failed" && score.clearType !== "Clear") {
            if (score.clearType === "Hard") experience += 25;
            else if (score.clearType === "Brave") experience += 50;
            else if (score.clearType === "Absolute") experience += 75;
            else if (score.clearType === "Catastrophy") experience += 100;
            else if (score.clearType === "All Correct!") experience += 150;
        }
    });
    
    // Achievement bonuses (one-time)
    const easyCompleted = easyScores.some(s => s.score === 30);
    if (easyCompleted) experience += 15; // Reduced from 25
    
    const masterCompleted = masterScores.some(s => s.score === 90);
    if (masterCompleted) experience += 75;
    
    const hellCompleted = hellScores.some(s => s.score === 200);
    if (hellCompleted) experience += 150;
    
    const raceCompleted = raceScores.some(s => s.grade === "GM"); // Completed all 130 questions (GM grade)
    if (raceCompleted) experience += 80;
    
    // Extra XP bonus for high grade points in race mode (gradePoints >= 1246000)
    const raceHighScore = raceScores.some(s => (s.gradePoints || s.score || 0) >= 1246000);
    if (raceHighScore) experience += 50; // Additional bonus for exceptional performance
        // Calculate level using exponential scaling
    // Level formula: level = floor(1 + sqrt(experience / 30))
    // This gives: Lv 1 = 0 XP, Lv 2 = 90 XP, Lv 3 = 240 XP, Lv 4 = 450 XP, etc.
    // Increased threshold: changed divisor from 20 to 30 (requires more XP per level)
    const finalLevel = Math.max(1, Math.floor(1 + Math.sqrt(experience / 30)));
    
    // Calculate XP needed for current level and next level
    const xpForCurrentLevel = Math.pow((finalLevel - 1), 2) * 30;
    const xpForNextLevel = Math.pow(finalLevel, 2) * 30;
    const xpInCurrentLevel = experience - xpForCurrentLevel;
    const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
    
    return { 
        level: finalLevel, 
        experience: experience,
        xpForCurrentLevel: xpForCurrentLevel,
        xpForNextLevel: xpForNextLevel,
        xpInCurrentLevel: xpInCurrentLevel,
        xpNeededForNextLevel: xpNeededForNextLevel
    };
}

// Export the function so it can be used by other modules (e.g., hm.js for navbar)
export { calculatePlayerLevel };

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

function summarizeScores(list, hasGrade = false, isHellMode = false, isMasterMode = false, isRaceMode = false) {
    if (!list.length) {
        return {
            games: 0,
            bestScore: "-",
            avgScore: "-",
            bestGrade: hasGrade ? "-" : undefined,
            completions: isRaceMode ? 0 : undefined,
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
    
    // Calculate completion count for race mode (GM grade means all 130 questions completed)
    let completions = undefined;
    if (isRaceMode) {
        completions = list.filter(s => s.grade === "GM").length;
    }
    
    return { games, bestScore, avgScore, bestGrade, completions };
}

// Store raw data lists for filtering
let allEasyList = [];
let allNormalList = [];
let allMasterList = [];
let allHellList = [];
let allRaceList = [];

// Get badge for level (uses thresholds from getBadgeNameStats)
function getBadgeForLevelStats(level) {
    if (level >= 2000) return "🌠"; // Meteor (Lv 2000+)
    if (level >= 1500) return "🌙"; // Moon (Lv 1500-1999)
    if (level >= 1250) return "☀️"; // Sun (Lv 1250-1499)
    if (level >= 1000) return "🌍"; // Earth (Lv 1000-1249)
    if (level >= 800) return "🪐"; // Planet (Lv 800-999)
    if (level >= 600) return "⭐"; // Star (Lv 600-799)
    if (level >= 400) return "🌟"; // Glowing Star (Lv 400-599)
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

// Update level progression display
function updateLevelProgression(playerData, totalPlays = 0, mainInput = null, createdAt = null) {
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
    
    // Use the new XP calculation system with exponential scaling
    // Level formula: level = floor(1 + sqrt(experience / 10))
    // XP for level N: (N-1)^2 * 10
    // XP for level N+1: N^2 * 10
    
    const xpForCurrentLevel = playerData.xpForCurrentLevel || Math.pow((finalLevel - 1), 2) * 10;
    const xpForNextLevel = playerData.xpForNextLevel || Math.pow(finalLevel, 2) * 10;
    const xpInCurrentLevel = playerData.xpInCurrentLevel || Math.max(0, experience - xpForCurrentLevel);
    const xpNeededForNextLevel = playerData.xpNeededForNextLevel || (xpForNextLevel - xpForCurrentLevel);
    
    // Calculate progress percentage
    const progressPercent = xpNeededForNextLevel > 0 
        ? Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForNextLevel) * 100))
        : 100;
    
    // Update display
    const badge = getBadgeForLevelStats(finalLevel);
    levelDisplay.innerHTML = `<span style="font-size: 1.2em; margin-right: 5px;">${badge}</span> Lv. ${finalLevel}`;
    currentXP.textContent = `${experience.toLocaleString()} XP`;
    nextLevelXP.textContent = `${xpForNextLevel.toLocaleString()} XP`;
    
    // Display timestamp and main input method in mainInputDisplay
    const mainInputDisplay = document.getElementById("mainInputDisplay");
    
    // Build content: timestamp first (always displayed), then main input method (if available)
    let contentParts = [];
    
    // Always display timestamp - show "Unknown" if not available
    const timestampText = createdAt ? formatRelativeTime(createdAt) : "Unknown";
    contentParts.push(`<div style="color: rgba(255, 255, 255, 0.8); font-size: 0.9em;">Joined ${timestampText}</div>`);
    
    // Add <hr> separator if main input method is present
    if (mainInput && mainInput.total > 0) {
        contentParts.push(`<hr style="margin: 10px 0; border: none; border-top: 1px solid rgba(255, 255, 255, 0.2);">`);
    }
    
    if (mainInput && mainInput.total > 0) {
        contentParts.push(`<strong style="color: #dbffff;">Main Input Method:</strong><br><span style="font-size: 1.2em; margin-top: 5px; display: inline-block;">${mainInput.icon} ${mainInput.name}</span>`);
    }
    
    if (contentParts.length > 0) {
        if (!mainInputDisplay) {
            // Create main input display element
            const mainInputDiv = document.createElement("div");
            mainInputDiv.id = "mainInputDisplay";
            mainInputDiv.style.cssText = "margin-top: 15px; padding-top: 15px; text-align: center; color: rgba(255, 255, 255, 0.9); font-size: 0.95em;";
            mainInputDiv.innerHTML = contentParts.join('');
            levelProgressionCard.querySelector(".level-progression-content").appendChild(mainInputDiv);
        } else {
            mainInputDisplay.innerHTML = contentParts.join('');
        }
    } else {
        // Remove main input display if no content
        if (mainInputDisplay) {
            mainInputDisplay.remove();
        }
    }
    
    // Get badge name for tooltip
    function getBadgeNameStats(level) {
        if (level >= 2000) return "Meteor";
        if (level >= 1500) return "Moon";
        if (level >= 1250) return "Sun";
        if (level >= 1000) return "Earth";
        if (level >= 800) return "Planet";
        if (level >= 600) return "Star";
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
    
    // Get color class based on level (synchronized with getBadgeNameStats thresholds)
    function getLevelColorClassStats(level) {
        if (level >= 2000) return "level-meteor";
        if (level >= 1500) return "level-moon";
        if (level >= 1250) return "level-sun";
        if (level >= 1000) return "level-earth";
        if (level >= 800) return "level-planet";
        if (level >= 600) return "level-star-high";
        if (level >= 400) return "level-glowing";
        if (level >= 300) return "level-dizzy";
        if (level >= 250) return "level-galaxy";
        if (level >= 200) return "level-shooting";
        if (level >= 150) return "level-atomic";
        if (level >= 120) return "level-crystal";
        if (level >= 100) return "level-sparkle";
        if (level >= 80) return "level-champion";
        if (level >= 70) return "level-royal";
        if (level >= 60) return "level-diamond";
        if (level >= 50) return "level-star";
        if (level >= 40) return "level-fire";
        if (level >= 35) return "level-lightning";
        if (level >= 30) return "level-shining";
        if (level >= 25) return "level-target";
        if (level >= 20) return "level-medal";
        if (level >= 15) return "level-trophy";
        if (level >= 12) return "level-gold";
        if (level >= 9) return "level-silver";
        if (level >= 6) return "level-bronze";
        if (level >= 3) return "level-star-low";
        return "level-sprout";
    }
    
    // Apply color class to progression card for dynamic progress bar styling
    const colorClass = getLevelColorClassStats(finalLevel);
    levelProgressionCard.className = `level-progression-card ${colorClass}`;
    
    // Add tooltip to level display if it exists in status bar
    const statusLevelDisplay = document.getElementById("playerLevel");
    if (statusLevelDisplay) {
        const badgeName = getBadgeNameStats(finalLevel);
        // Create tooltip element with larger badge name
        let tooltip = statusLevelDisplay.querySelector(".player-level-tooltip");
        if (!tooltip) {
            tooltip = document.createElement("div");
            tooltip.className = "player-level-tooltip";
            statusLevelDisplay.appendChild(tooltip);
        }
        const mainInputText = mainInput ? `${mainInput.icon} ${mainInput.name}` : "❓ Unknown";
        tooltip.innerHTML = `
            <div class="tooltip-badge-name">${badgeName}</div>
            <div class="tooltip-stats">Total XP: ${experience.toLocaleString()}<br>Total Plays: ${totalPlays.toLocaleString()}<br>Main Input: ${mainInputText}</div>
        `;
        // Store formatted data for hover tooltip (for fallback CSS ::before)
        statusLevelDisplay.setAttribute("data-badge", badgeName);
        statusLevelDisplay.setAttribute("data-xp", experience.toLocaleString());
        statusLevelDisplay.setAttribute("data-plays", totalPlays.toLocaleString());
        // Update color class
        statusLevelDisplay.className = `player-level ${getLevelColorClassStats(finalLevel)}`;
        if (!statusLevelDisplay.classList.contains("hide")) {
            statusLevelDisplay.classList.remove("hide");
        }
    }
    
    // Update progress bar
    xpProgressBar.style.width = `${progressPercent}%`;
    if (xpProgressText) {
        // Only show text if progress bar is wide enough
        if (progressPercent > 15) {
            xpProgressText.textContent = `${xpInCurrentLevel.toLocaleString()} / ${xpNeededForNextLevel.toLocaleString()}`;
        } else {
            xpProgressText.textContent = "";
        }
    }
}

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
            
            // Re-render the stats for this mode
            renderModeStats(mode);
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
            
            // Re-render the stats for this mode
            renderModeStats(mode);
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
            
            // Re-render the stats for this mode
            renderModeStats(mode);
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
            
            // Re-render the stats for this mode
            renderModeStats(mode);
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

document.addEventListener("DOMContentLoaded", () => {
    // Initialize tabs
    initTabs();
    
    const nameSpan = document.querySelector(".name");
    const statsContainer = document.querySelector(".container2");
    
    // Close notification button handler
    const closeNotificationBtn = document.getElementById("closeNotification");
    const notification = document.getElementById("loginNotification");
    if (closeNotificationBtn && notification) {
        closeNotificationBtn.addEventListener("click", () => {
            notification.style.display = "none";
        });
    }

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
            
            // Display notification for logged out users
            const notification = document.getElementById("loginNotification");
            if (notification) {
                notification.style.display = "block";
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
        // Show the stats container when logged in
        if (statsContainer) {
            statsContainer.style.display = "";
        }

    try {
            // Read per‑player data from Firestore subcollections
            const uid = user.uid;
        const [easySnap, normalSnap, masterSnap, hellSnap, raceSnap, secretSnap, userProfileSnap] = await Promise.all([
                getDocs(collection(db, "playerData", uid, "easy")),
                getDocs(collection(db, "playerData", uid, "normal")),
                getDocs(collection(db, "playerData", uid, "master")),
                getDocs(collection(db, "playerData", uid, "hell")),
                getDocs(collection(db, "playerData", uid, "race")),
                getDocs(collection(db, "playerData", uid, "secret")).catch(() => ({ empty: true, docs: [] })),
                getDoc(doc(db, "userProfiles", uid)).catch(() => null),
            ]);
            
            const userProfile = userProfileSnap && userProfileSnap.exists() ? userProfileSnap.data() : null;
            // Try to get createdAt from userProfile, fallback to Firebase Auth metadata
            let createdAt = userProfile ? userProfile.createdAt : null;
            if (!createdAt && user.metadata && user.metadata.creationTime) {
                createdAt = user.metadata.creationTime;
            }

            const listFromSnap = (snap) => {
                if (snap.empty) return [];
                return snap.docs.map((doc) => doc.data());
            };

            // Store raw data lists
            allEasyList = listFromSnap(easySnap);
            allNormalList = listFromSnap(normalSnap);
            allMasterList = listFromSnap(masterSnap);
            allHellList = listFromSnap(hellSnap);
            allRaceList = listFromSnap(raceSnap);
            const secretList = listFromSnap(secretSnap);

            // Calculate and display player level and XP
            const playerData = calculatePlayerLevel(allEasyList, allNormalList, allMasterList, allHellList, secretList, allRaceList);
            const totalPlays = allEasyList.length + allNormalList.length + allMasterList.length + allHellList.length + allRaceList.length + (secretList ? secretList.length : 0);
            const mainInput = calculateMainInputMethod(allEasyList, allNormalList, allMasterList, allHellList, secretList, allRaceList);
            updateLevelProgression(playerData, totalPlays, mainInput, createdAt);

            // Populate filter dropdowns with unique values from database
            populateFilterDropdowns('easy', allEasyList);
            populateFilterDropdowns('normal', allNormalList);
            populateFilterDropdowns('master', allMasterList);
            populateFilterDropdowns('race', allRaceList);
            populateFilterDropdowns('hell', allHellList);

            // Render all modes
            renderModeStats('easy');
            renderModeStats('normal');
            renderModeStats('master');
            renderModeStats('race');
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
        case 'race':
            dataList = filterScores(allRaceList, currentFilter.race);
            hasGrade = false; // No grades in race mode
            isMaster = false;
            break;
        case 'hell':
            dataList = filterScores(allHellList, currentFilter.hell);
            hasGrade = true;
            isHell = true;
            break;
    }
    
    // Calculate stats
    const isRace = mode === 'race';
    const stats = summarizeScores(dataList, hasGrade, isHell, isMaster, isRace);
    
    // Get table IDs
    const statsTableId = `${mode}Stats`;
    const historyTableId = `${mode}History`;
    const chartId = `${mode}Chart`;
    
    // Fill stats table
    const fillRow = (tableId, stats, hasGrade = false, isMaster = false, dataList = [], mode = '') => {
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
        } else if (mode === 'race' && stats.completions !== undefined) {
            // Race mode: show completion count instead of grade
            row.innerHTML = `
                <td>${stats.games}</td>
                <td class="${stats.bestScore !== "-" ? "high-score" : ""}">${formatScore(stats.bestScore)}</td>
                <td>${formatScore(stats.avgScore)}</td>
                <td>${stats.completions}</td>
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
    
    fillRow(statsTableId, stats, hasGrade, isMaster, dataList, mode);
    
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
            
            // Format pause count display
            const pauseCount = entry.pauseCount || 0;
            const pauseDisplay = pauseCount > 0 ? `<div style="font-size: 0.8em; color: #888; margin-top: 2px;">Pauses: ${pauseCount}</div>` : '';
            
            // Format modifiers display
            const modifiersDisplay = formatModifiers(entry.modifiers);
            
            // Format clear type display
            const clearTypeDisplay = entry.clearType ? `<span style="color: #4CAF50; font-weight: bold;">${entry.clearType}</span>` : '';
            
            if (hasGrade) {
                const gradeDisplay = entry.grade 
                    ? `<span class="grade-badge" style="color: ${getLineColor(entry)}">${formatGrade(entry.grade)}</span>` 
                    : "-";
                row.innerHTML = `
                    <td>${dateStr}</td>
                    <td class="${entry.score ? "high-score" : ""}">${formatScore(entry.score)}${modifiersDisplay}</td>
                    <td>${gradeDisplay}</td>
                    <td>${entry.time || "-"}${pauseDisplay}</td>
                    <td>${clearTypeDisplay || "-"}</td>
                    <td>${inputTypeDisplay}</td>
                `;
            } else {
                row.innerHTML = `
                    <td>${dateStr}</td>
                    <td class="${entry.score ? "high-score" : ""}">${formatScore(entry.score)}${modifiersDisplay}</td>
                    <td>${entry.time || "-"}${pauseDisplay}</td>
                    <td>${clearTypeDisplay || "-"}</td>
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
    
    // Close notification button handler
    const closeNotificationBtn = document.getElementById("closeNotification");
    const notification = document.getElementById("loginNotification");
    if (closeNotificationBtn && notification) {
        closeNotificationBtn.addEventListener("click", () => {
            notification.style.display = "none";
        });
    }

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
            
            // Display notification for logged out users
            const notification = document.getElementById("loginNotification");
            if (notification) {
                notification.style.display = "block";
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
        // Hide notification when logged in
        const notification = document.getElementById("loginNotification");
        if (notification) {
            notification.style.display = "none";
        }
        // Show the stats container when logged in
        if (statsContainer) {
            statsContainer.style.display = "";
        }

        try {
            // Read per‑player data from Firestore subcollections
            const uid = user.uid;
            const [easySnap, normalSnap, masterSnap, hellSnap, raceSnap, secretSnap, userProfileSnap] = await Promise.all([
                getDocs(collection(db, "playerData", uid, "easy")),
                getDocs(collection(db, "playerData", uid, "normal")),
                getDocs(collection(db, "playerData", uid, "master")),
                getDocs(collection(db, "playerData", uid, "hell")),
                getDocs(collection(db, "playerData", uid, "race")),
                getDocs(collection(db, "playerData", uid, "secret")).catch(() => ({ empty: true, docs: [] })),
                getDoc(doc(db, "userProfiles", uid)).catch(() => null),
            ]);
            
            const userProfile = userProfileSnap && userProfileSnap.exists() ? userProfileSnap.data() : null;
            // Try to get createdAt from userProfile, fallback to Firebase Auth metadata
            let createdAt = userProfile ? userProfile.createdAt : null;
            if (!createdAt && user.metadata && user.metadata.creationTime) {
                createdAt = user.metadata.creationTime;
            }

            const listFromSnap = (snap) => {
                if (snap.empty) return [];
                return snap.docs.map((doc) => doc.data());
            };

            // Store raw data lists
            allEasyList = listFromSnap(easySnap);
            allNormalList = listFromSnap(normalSnap);
            allMasterList = listFromSnap(masterSnap);
            allHellList = listFromSnap(hellSnap);
            allRaceList = listFromSnap(raceSnap);
            const secretList = listFromSnap(secretSnap);

            // Calculate and display player level and XP
            const playerData = calculatePlayerLevel(allEasyList, allNormalList, allMasterList, allHellList, secretList, allRaceList);
            const totalPlays = allEasyList.length + allNormalList.length + allMasterList.length + allHellList.length + allRaceList.length + (secretList ? secretList.length : 0);
            const mainInput = calculateMainInputMethod(allEasyList, allNormalList, allMasterList, allHellList, secretList, allRaceList);
            updateLevelProgression(playerData, totalPlays, mainInput, createdAt);

            // Render all modes
            renderModeStats('easy');
            renderModeStats('normal');
            renderModeStats('master');
            renderModeStats('race');
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

    // Destroy existing chart if it exists
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
        existingChart.destroy();
    }
    
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


