import { getAuth, getFirestore, collection, getDocs, doc, getDoc } from "./firebase.js";
import { calculatePlayerLevel } from "./stats.js";

// Helper function to check if a score has a specific clear type
function hasClearType(score, clearType) {
  if (!score || !score.clearType) return false;
  return score.clearType === clearType;
}

// Helper function to check if a score has 2x time multiplier
function has2xTimeMultiplier(score) {
  if (!score || !score.modifiers) return false;
  return score.modifiers.timeMultiplier >= 2.0;
}

// Helper function to check if a score has 0.5s vanish timer
function has05sVanishTimer(score) {
  if (!score || !score.modifiers) return false;
  return score.modifiers.fadingMode === "0.5" || score.modifiers.fadingMode === 0.5;
}

// Helper function to check modifier combinations across all modes
function hasModifierCombination(data, checkFunction) {
  const allScores = [
    ...(data.easyScores || []),
    ...(data.normalScores || []),
    ...(data.masterScores || []),
    ...(data.hellScores || []),
    ...(data.raceScores || [])
  ];
  return allScores.some(checkFunction);
}

// All achievements configuration (same as achievements.html)
const COMPLETION_ACHIEVEMENTS = [
  {
    id: 'easy_complete',
    icon: '<i class="fas fa-check-circle"></i>',
    title: 'Easy Mode Master',
    description: 'Complete Easy Mode with a perfect score of 30',
    unlockedMessage: '<i class="fas fa-party-horn"></i> Perfect run! You\'ve mastered the basics!',
    checkUnlocked: (data) => data.easyScores?.some(s => s.score === 30) || false
  },
  {
    id: 'normal_complete',
    icon: '<i class="fas fa-star"></i>',
    title: 'Normal Mode Expert',
    description: 'Complete Normal Mode with a perfect score of 100',
    unlockedMessage: '<i class="fas fa-star"></i> Flawless execution! You\'re a true expert!',
    checkUnlocked: (data) => data.normalScores?.some(s => s.score === 100) || false
  },
  {
    id: 'master_complete',
    icon: '<i class="fas fa-crown"></i>',
    title: 'Master Mode Champion',
    description: 'Achieve GM grade in Master Mode',
    unlockedMessage: '<i class="fas fa-crown"></i> Royal perfection! You\'ve conquered the master challenge!',
    checkUnlocked: (data) => data.masterScores?.some(s => s.grade === "GM") || false
  },
  {
    id: 'hell_complete',
    icon: '<i class="fas fa-fire"></i>',
    title: 'Hell Mode Conqueror',
    description: 'Complete Hell Mode with a perfect score of 200',
    unlockedMessage: '<i class="fas fa-fire"></i> Infernal mastery! You\'ve survived the impossible!',
    checkUnlocked: (data) => data.hellScores?.some(s => s.score === 200) || false
  },
  {
    id: 'race_complete',
    icon: '<i class="fas fa-flag-checkered"></i>',
    title: 'Race Mode Grand Master',
    description: 'Complete Race Mode and achieve GM grade',
    unlockedMessage: '<i class="fas fa-flag-checkered"></i> Grand Master achieved! The ultimate racing legend!',
    checkUnlocked: (data) => data.raceScores?.some(s => s.grade === "GM") || false
  },
  {
    id: 'race_high_score',
    icon: '<i class="fas fa-gem"></i>',
    title: 'Race Mode Excellence',
    description: 'Achieve 1,246,000 grade points or higher in Race Mode',
    unlockedMessage: '<i class="fas fa-gem"></i> Exceptional performance! You\'ve reached the pinnacle!',
    checkUnlocked: (data) => data.raceScores?.some(s => (s.gradePoints || s.score || 0) >= 1246000) || false
  },
  {
    id: 'secret_complete',
    icon: '<i class="fas fa-skull"></i>',
    title: 'Secret Mode Master',
    description: 'Complete Secret Mode with a perfect score of 300',
    unlockedMessage: '<i class="fas fa-skull"></i> The ultimate secret revealed! You\'ve conquered the final challenge!',
    checkUnlocked: (data) => data.secretScores?.some(s => s.score === 300) || false,
    isHidden: (data) => !data.hasUnlockedSecretMode
  }
];

const SPECIAL_ACHIEVEMENTS = [
  {
    id: 'first_game',
    icon: '<i class="fas fa-gamepad"></i>',
    title: 'First Steps',
    description: 'Complete your first game in any mode',
    unlockedMessage: '<i class="fas fa-gamepad"></i> Welcome to the journey! Your adventure begins!',
    checkUnlocked: (data) => {
      const totalGames = (data.easyScores?.length || 0) + (data.normalScores?.length || 0) + 
                        (data.masterScores?.length || 0) + (data.raceScores?.length || 0) + 
                        (data.hellScores?.length || 0);
      return totalGames > 0;
    }
  },
  {
    id: 'all_modes',
    icon: '<i class="fas fa-star"></i>',
    title: 'Mode Explorer',
    description: 'Play at least one game in all 5 game modes',
    unlockedMessage: '<i class="fas fa-star"></i> True explorer! You\'ve experienced every challenge!',
    checkUnlocked: (data) => {
      return (data.easyScores?.length || 0) > 0 && 
             (data.normalScores?.length || 0) > 0 && 
             (data.masterScores?.length || 0) > 0 && 
             (data.raceScores?.length || 0) > 0 && 
             (data.hellScores?.length || 0) > 0;
    }
  },
  {
    id: 'level_10',
    icon: '<i class="fas fa-sparkles"></i>',
    title: 'Rising Star',
    description: 'Reach Level 10',
    unlockedMessage: '<i class="fas fa-sparkles"></i> Shining bright! You\'re on the rise!',
    checkUnlocked: (data) => (data.playerData?.level || 0) >= 10
  },
  {
    id: 'level_50',
    icon: '<i class="fas fa-star"></i>',
    title: 'Star Player',
    description: 'Reach Level 50',
    unlockedMessage: '<i class="fas fa-star"></i> Stellar achievement! You\'re a true star!',
    checkUnlocked: (data) => (data.playerData?.level || 0) >= 50
  },
  {
    id: 'level_100',
    icon: '<i class="fas fa-sparkles"></i>',
    title: 'Sparkle Master',
    description: 'Reach Level 100',
    unlockedMessage: '<i class="fas fa-sparkles"></i> Master of sparkles! You\'ve reached greatness!',
    checkUnlocked: (data) => (data.playerData?.level || 0) >= 100
  },
  // 10 Lives Clear Achievements (Absolute)
  {
    id: 'easy_10_lives',
    icon: '<i class="fas fa-sword"></i>',
    title: 'Easy Mode Absolute',
    description: 'Clear Easy Mode with 10 lives (Absolute clear)',
    unlockedMessage: '<i class="fas fa-sword"></i> Absolute precision! You\'ve mastered the art of survival!',
    checkUnlocked: (data) => data.easyScores?.some(s => hasClearType(s, "Absolute")) || false
  },
  {
    id: 'normal_10_lives',
    icon: '<i class="fas fa-sword"></i>',
    title: 'Normal Mode Absolute',
    description: 'Clear Normal Mode with 10 lives (Absolute clear)',
    unlockedMessage: '<i class="fas fa-sword"></i> Absolute precision! You\'ve mastered the art of survival!',
    checkUnlocked: (data) => data.normalScores?.some(s => hasClearType(s, "Absolute")) || false
  },
  {
    id: 'master_10_lives',
    icon: '<i class="fas fa-sword"></i>',
    title: 'Master Mode Absolute',
    description: 'Clear Master Mode with 10 lives (Absolute clear)',
    unlockedMessage: '<i class="fas fa-sword"></i> Absolute precision! You\'ve mastered the art of survival!',
    checkUnlocked: (data) => data.masterScores?.some(s => hasClearType(s, "Absolute")) || false
  },
  {
    id: 'hell_10_lives',
    icon: '<i class="fas fa-sword"></i>',
    title: 'Hell Mode Absolute',
    description: 'Clear Hell Mode with 10 lives (Absolute clear)',
    unlockedMessage: '<i class="fas fa-sword"></i> Absolute precision! You\'ve mastered the art of survival!',
    checkUnlocked: (data) => data.hellScores?.some(s => hasClearType(s, "Absolute")) || false
  },
  {
    id: 'race_10_lives',
    icon: '<i class="fas fa-sword"></i>',
    title: 'Race Mode Absolute',
    description: 'Clear Race Mode with 10 lives (Absolute clear)',
    unlockedMessage: '<i class="fas fa-sword"></i> Absolute precision! You\'ve mastered the art of survival!',
    checkUnlocked: (data) => data.raceScores?.some(s => hasClearType(s, "Absolute")) || false
  },
  // 5 Lives Clear Achievements (Catastrophy)
  {
    id: 'easy_5_lives',
    icon: '<i class="fas fa-skull"></i>',
    title: 'Easy Mode Catastrophy',
    description: 'Clear Easy Mode with 5 lives (Catastrophy clear)',
    unlockedMessage: '<i class="fas fa-skull"></i> Catastrophic skill! You\'ve defied all odds!',
    checkUnlocked: (data) => data.easyScores?.some(s => hasClearType(s, "Catastrophy")) || false
  },
  {
    id: 'normal_5_lives',
    icon: '<i class="fas fa-skull"></i>',
    title: 'Normal Mode Catastrophy',
    description: 'Clear Normal Mode with 5 lives (Catastrophy clear)',
    unlockedMessage: '<i class="fas fa-skull"></i> Catastrophic skill! You\'ve defied all odds!',
    checkUnlocked: (data) => data.normalScores?.some(s => hasClearType(s, "Catastrophy")) || false
  },
  {
    id: 'master_5_lives',
    icon: '<i class="fas fa-skull"></i>',
    title: 'Master Mode Catastrophy',
    description: 'Clear Master Mode with 5 lives (Catastrophy clear)',
    unlockedMessage: '<i class="fas fa-skull"></i> Catastrophic skill! You\'ve defied all odds!',
    checkUnlocked: (data) => data.masterScores?.some(s => hasClearType(s, "Catastrophy")) || false
  },
  {
    id: 'hell_5_lives',
    icon: '<i class="fas fa-skull"></i>',
    title: 'Hell Mode Catastrophy',
    description: 'Clear Hell Mode with 5 lives (Catastrophy clear)',
    unlockedMessage: '<i class="fas fa-skull"></i> Catastrophic skill! You\'ve defied all odds!',
    checkUnlocked: (data) => data.hellScores?.some(s => hasClearType(s, "Catastrophy")) || false
  },
  {
    id: 'race_5_lives',
    icon: '<i class="fas fa-skull"></i>',
    title: 'Race Mode Catastrophy',
    description: 'Clear Race Mode with 5 lives (Catastrophy clear)',
    unlockedMessage: '<i class="fas fa-skull"></i> Catastrophic skill! You\'ve defied all odds!',
    checkUnlocked: (data) => data.raceScores?.some(s => hasClearType(s, "Catastrophy")) || false
  },
  // 1 Life Clear Achievements (All Correct!)
  {
    id: 'easy_1_life',
    icon: '<i class="fas fa-crown"></i>',
    title: 'Easy Mode Perfect',
    description: 'Clear Easy Mode with 1 life and no wrong answers (All Correct!)',
    unlockedMessage: '<i class="fas fa-crown"></i> Perfect execution! Flawless victory achieved!',
    checkUnlocked: (data) => data.easyScores?.some(s => hasClearType(s, "All Correct!")) || false
  },
  {
    id: 'normal_1_life',
    icon: '<i class="fas fa-crown"></i>',
    title: 'Normal Mode Perfect',
    description: 'Clear Normal Mode with 1 life and no wrong answers (All Correct!)',
    unlockedMessage: '<i class="fas fa-crown"></i> Perfect execution! Flawless victory achieved!',
    checkUnlocked: (data) => data.normalScores?.some(s => hasClearType(s, "All Correct!")) || false
  },
  {
    id: 'master_1_life',
    icon: '<i class="fas fa-crown"></i>',
    title: 'Master Mode Perfect',
    description: 'Clear Master Mode with 1 life and no wrong answers (All Correct!)',
    unlockedMessage: '<i class="fas fa-crown"></i> Perfect execution! Flawless victory achieved!',
    checkUnlocked: (data) => data.masterScores?.some(s => hasClearType(s, "All Correct!")) || false
  },
  {
    id: 'hell_1_life',
    icon: '<i class="fas fa-crown"></i>',
    title: 'Hell Mode Perfect',
    description: 'Clear Hell Mode with 1 life and no wrong answers (All Correct!)',
    unlockedMessage: '<i class="fas fa-crown"></i> Perfect execution! Flawless victory achieved!',
    checkUnlocked: (data) => data.hellScores?.some(s => hasClearType(s, "All Correct!")) || false
  },
  {
    id: 'race_1_life',
    icon: '<i class="fas fa-crown"></i>',
    title: 'Race Mode Perfect',
    description: 'Clear Race Mode with 1 life and no wrong answers (All Correct!)',
    unlockedMessage: '<i class="fas fa-crown"></i> Perfect execution! Flawless victory achieved!',
    checkUnlocked: (data) => data.raceScores?.some(s => hasClearType(s, "All Correct!")) || false
  },
  // 2x Time Multiplier Achievements
  {
    id: 'easy_2x_time',
    icon: '<i class="fas fa-bolt"></i>',
    title: 'Easy Mode Speed Demon',
    description: 'Clear Easy Mode with 2x time multiplier',
    unlockedMessage: '<i class="fas fa-bolt"></i> Lightning fast! Time is your enemy, but you conquered it!',
    checkUnlocked: (data) => data.easyScores?.some(has2xTimeMultiplier) || false
  },
  {
    id: 'normal_2x_time',
    icon: '<i class="fas fa-bolt"></i>',
    title: 'Normal Mode Speed Demon',
    description: 'Clear Normal Mode with 2x time multiplier',
    unlockedMessage: '<i class="fas fa-bolt"></i> Lightning fast! Time is your enemy, but you conquered it!',
    checkUnlocked: (data) => data.normalScores?.some(has2xTimeMultiplier) || false
  },
  {
    id: 'master_2x_time',
    icon: '<i class="fas fa-bolt"></i>',
    title: 'Master Mode Speed Demon',
    description: 'Clear Master Mode with 2x time multiplier',
    unlockedMessage: '<i class="fas fa-bolt"></i> Lightning fast! Time is your enemy, but you conquered it!',
    checkUnlocked: (data) => data.masterScores?.some(has2xTimeMultiplier) || false
  },
  {
    id: 'hell_2x_time',
    icon: '<i class="fas fa-bolt"></i>',
    title: 'Hell Mode Speed Demon',
    description: 'Clear Hell Mode with 2x time multiplier',
    unlockedMessage: '<i class="fas fa-bolt"></i> Lightning fast! Time is your enemy, but you conquered it!',
    checkUnlocked: (data) => data.hellScores?.some(has2xTimeMultiplier) || false
  },
  {
    id: 'race_2x_time',
    icon: '<i class="fas fa-bolt"></i>',
    title: 'Race Mode Speed Demon',
    description: 'Clear Race Mode with 2x time multiplier',
    unlockedMessage: '<i class="fas fa-bolt"></i> Lightning fast! Time is your enemy, but you conquered it!',
    checkUnlocked: (data) => data.raceScores?.some(has2xTimeMultiplier) || false
  },
  // 0.5s Vanish Timer Achievements
  {
    id: 'easy_05s_vanish',
    icon: '<i class="fas fa-eye"></i>',
    title: 'Easy Mode Blink Master',
    description: 'Clear Easy Mode with 0.5s vanish timer',
    unlockedMessage: '<i class="fas fa-eye"></i> Blink and you\'ll miss it! Your memory is legendary!',
    checkUnlocked: (data) => data.easyScores?.some(has05sVanishTimer) || false
  },
  {
    id: 'normal_05s_vanish',
    icon: '<i class="fas fa-eye"></i>',
    title: 'Normal Mode Blink Master',
    description: 'Clear Normal Mode with 0.5s vanish timer',
    unlockedMessage: '<i class="fas fa-eye"></i> Blink and you\'ll miss it! Your memory is legendary!',
    checkUnlocked: (data) => data.normalScores?.some(has05sVanishTimer) || false
  },
  {
    id: 'master_05s_vanish',
    icon: '<i class="fas fa-eye"></i>',
    title: 'Master Mode Blink Master',
    description: 'Clear Master Mode with 0.5s vanish timer',
    unlockedMessage: '<i class="fas fa-eye"></i> Blink and you\'ll miss it! Your memory is legendary!',
    checkUnlocked: (data) => data.masterScores?.some(has05sVanishTimer) || false
  },
  {
    id: 'hell_05s_vanish',
    icon: '<i class="fas fa-eye"></i>',
    title: 'Hell Mode Blink Master',
    description: 'Clear Hell Mode with 0.5s vanish timer',
    unlockedMessage: '<i class="fas fa-eye"></i> Blink and you\'ll miss it! Your memory is legendary!',
    checkUnlocked: (data) => data.hellScores?.some(has05sVanishTimer) || false
  },
  {
    id: 'race_05s_vanish',
    icon: '<i class="fas fa-eye"></i>',
    title: 'Race Mode Blink Master',
    description: 'Clear Race Mode with 0.5s vanish timer',
    unlockedMessage: '<i class="fas fa-eye" style="color: #a29bfe;"></i> Blink and you\'ll miss it! Your memory is legendary!',
    checkUnlocked: (data) => data.raceScores?.some(has05sVanishTimer) || false
  }
];

const COMBINATION_ACHIEVEMENTS = [
  {
    id: 'vanish_05s_10_lives',
    icon: '<i class="fas fa-sword"></i><i class="fas fa-eye"></i>',
    title: 'Absolute Blink',
    description: 'Clear any mode with 0.5s vanish timer and 10 lives (Absolute clear)',
    unlockedMessage: '<i class="fas fa-sword"></i><i class="fas fa-eye"></i> Perfect memory under pressure! Absolute mastery achieved!',
    checkUnlocked: (data) => hasModifierCombination(data, (score) => 
      has05sVanishTimer(score) && hasClearType(score, "Absolute")
    )
  },
  {
    id: 'vanish_05s_5_lives',
    icon: '<i class="fas fa-skull"></i><i class="fas fa-eye"></i>',
    title: 'Catastrophic Blink',
    description: 'Clear any mode with 0.5s vanish timer and 5 lives (Catastrophy clear)',
    unlockedMessage: '<i class="fas fa-skull"></i><i class="fas fa-eye"></i> Catastrophic memory challenge! You\'ve defied all odds!',
    checkUnlocked: (data) => hasModifierCombination(data, (score) => 
      has05sVanishTimer(score) && hasClearType(score, "Catastrophy")
    )
  },
  {
    id: 'vanish_05s_1_life',
    icon: '<i class="fas fa-crown"></i><i class="fas fa-eye"></i>',
    title: 'Perfect Blink',
    description: 'Clear any mode with 0.5s vanish timer and 1 life (All Correct!)',
    unlockedMessage: '<i class="fas fa-crown"></i><i class="fas fa-eye"></i> Perfect memory perfection! Flawless blink mastery!',
    checkUnlocked: (data) => hasModifierCombination(data, (score) => 
      has05sVanishTimer(score) && hasClearType(score, "All Correct!")
    )
  },
  {
    id: '2x_time_10_lives',
    icon: '<i class="fas fa-bolt"></i><i class="fas fa-sword"></i>',
    title: 'Absolute Speed',
    description: 'Clear any mode with 2x time multiplier and 10 lives (Absolute clear)',
    unlockedMessage: '<i class="fas fa-bolt"></i><i class="fas fa-sword"></i> Lightning-fast precision! Absolute speed achieved!',
    checkUnlocked: (data) => hasModifierCombination(data, (score) => 
      has2xTimeMultiplier(score) && hasClearType(score, "Absolute")
    )
  },
  {
    id: '2x_time_5_lives',
    icon: '<i class="fas fa-bolt"></i><i class="fas fa-skull"></i>',
    title: 'Catastrophic Speed',
    description: 'Clear any mode with 2x time multiplier and 5 lives (Catastrophy clear)',
    unlockedMessage: '<i class="fas fa-bolt"></i><i class="fas fa-skull"></i> Catastrophic speed! You\'ve raced against time itself!',
    checkUnlocked: (data) => hasModifierCombination(data, (score) => 
      has2xTimeMultiplier(score) && hasClearType(score, "Catastrophy")
    )
  },
  {
    id: '2x_time_1_life',
    icon: '<i class="fas fa-bolt"></i><i class="fas fa-crown"></i>',
    title: 'Perfect Speed',
    description: 'Clear any mode with 2x time multiplier and 1 life (All Correct!)',
    unlockedMessage: '<i class="fas fa-bolt"></i><i class="fas fa-crown"></i> Perfect speed perfection! Flawless lightning mastery!',
    checkUnlocked: (data) => hasModifierCombination(data, (score) => 
      has2xTimeMultiplier(score) && hasClearType(score, "All Correct!")
    )
  },
  {
    id: 'vanish_05s_2x_time',
    icon: '<i class="fas fa-eye"></i><i class="fas fa-bolt"></i>',
    title: 'Blink Speed',
    description: 'Clear any mode with 0.5s vanish timer and 2x time multiplier',
    unlockedMessage: '<i class="fas fa-eye"></i><i class="fas fa-bolt"></i> Blink-speed mastery! Memory and time combined!',
    checkUnlocked: (data) => hasModifierCombination(data, (score) => 
      has05sVanishTimer(score) && has2xTimeMultiplier(score)
    )
  },
  {
    id: 'vanish_05s_2x_time_10_lives',
    icon: '<i class="fas fa-sword"></i><i class="fas fa-eye"></i><i class="fas fa-bolt"></i>',
    title: 'Absolute Blink Speed',
    description: 'Clear any mode with 0.5s vanish, 2x time, and 10 lives (Absolute clear)',
    unlockedMessage: '<i class="fas fa-sword"></i><i class="fas fa-eye"></i><i class="fas fa-bolt"></i> Ultimate challenge conquered! Absolute blink-speed mastery!',
    checkUnlocked: (data) => hasModifierCombination(data, (score) => 
      has05sVanishTimer(score) && has2xTimeMultiplier(score) && hasClearType(score, "Absolute")
    )
  },
  {
    id: 'vanish_05s_2x_time_5_lives',
    icon: '<i class="fas fa-skull"></i><i class="fas fa-eye"></i><i class="fas fa-bolt"></i>',
    title: 'Catastrophic Blink Speed',
    description: 'Clear any mode with 0.5s vanish, 2x time, and 5 lives (Catastrophy clear)',
    unlockedMessage: '<i class="fas fa-skull"></i><i class="fas fa-eye"></i><i class="fas fa-bolt"></i> Catastrophic blink-speed! The ultimate test passed!',
    checkUnlocked: (data) => hasModifierCombination(data, (score) => 
      has05sVanishTimer(score) && has2xTimeMultiplier(score) && hasClearType(score, "Catastrophy")
    )
  },
  {
    id: 'vanish_05s_2x_time_1_life',
    icon: '<i class="fas fa-crown"></i><i class="fas fa-eye"></i><i class="fas fa-bolt"></i>',
    title: 'Perfect Blink Speed',
    description: 'Clear any mode with 0.5s vanish, 2x time, and 1 life (All Correct!)',
    unlockedMessage: '<i class="fas fa-crown"></i><i class="fas fa-eye"></i><i class="fas fa-bolt"></i> Perfect blink-speed perfection! The ultimate achievement unlocked!',
    checkUnlocked: (data) => hasModifierCombination(data, (score) => 
      has05sVanishTimer(score) && has2xTimeMultiplier(score) && hasClearType(score, "All Correct!")
    )
  }
];

// Combine all achievements
const ALL_ACHIEVEMENTS = [
  ...COMPLETION_ACHIEVEMENTS,
  ...SPECIAL_ACHIEVEMENTS,
  ...COMBINATION_ACHIEVEMENTS
];

/**
 * Check for newly unlocked achievements after a score submission
 * @param {string} mode - The game mode ('easy', 'normal', 'master', 'hell', 'race', 'secret')
 * @returns {Promise<Array>} Array of newly unlocked achievement objects
 */
export async function checkNewAchievements(mode) {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    return []; // No achievements for logged out users
  }

  try {
    const db = getFirestore();
    
    // Fetch all scores
    const [easySnapshot, normalSnapshot, masterSnapshot, raceSnapshot, hellSnapshot] = await Promise.all([
      getDocs(collection(db, 'scoreseasy')),
      getDocs(collection(db, 'scoresnormal')),
      getDocs(collection(db, 'scoresmaster')),
      getDocs(collection(db, 'scoresrace')),
      getDocs(collection(db, 'scoresfinal'))
    ]);

    const allEasyScores = easySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allNormalScores = normalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allMasterScores = masterSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allRaceScores = raceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allHellScores = hellSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get user profile to find all usernames
    const userProfileRef = doc(db, 'userProfiles', user.uid);
    const userProfileSnap = await getDoc(userProfileRef);
    let allPlayerNames = new Set();
    
    if (userProfileSnap.exists()) {
      const userData = userProfileSnap.data();
      if (userData.displayName) allPlayerNames.add(userData.displayName);
      if (userData.email) allPlayerNames.add(userData.email);
      if (userData.previousUsernames && Array.isArray(userData.previousUsernames)) {
        userData.previousUsernames.forEach(name => {
          if (name) allPlayerNames.add(name);
        });
      }
    }

    // Filter scores for this player
    const easyScores = allEasyScores.filter(s => allPlayerNames.has(s.name));
    const normalScores = allNormalScores.filter(s => allPlayerNames.has(s.name));
    const masterScores = allMasterScores.filter(s => allPlayerNames.has(s.name));
    const raceScores = allRaceScores.filter(s => allPlayerNames.has(s.name));
    const hellScores = allHellScores.filter(s => allPlayerNames.has(s.name));

    // Fetch secret scores
    let secretScores = [];
    try {
      const secretSnapshot = await getDocs(collection(db, 'playerData', user.uid, 'secret'));
      secretScores = secretSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      secretScores = [];
    }

    // Check if player has unlocked secret mode
    const hasUnlockedSecretMode = hellScores.some(s => s.score === 200);

    // Calculate level
    const playerData = calculatePlayerLevel(easyScores, normalScores, masterScores, hellScores, secretScores, raceScores);

    // Prepare data object for achievement checks
    const achievementData = {
      easyScores,
      normalScores,
      masterScores,
      raceScores,
      hellScores,
      secretScores,
      hasUnlockedSecretMode,
      playerData,
      currentLevel: playerData.level,
      isLoggedIn: true
    };

    // Get previously unlocked achievements from localStorage
    const previouslyUnlocked = JSON.parse(localStorage.getItem('unlockedAchievements') || '[]');
    const previouslyUnlockedSet = new Set(previouslyUnlocked);

    // Check all achievements and find newly unlocked ones
    const newlyUnlocked = [];
    
    for (const achievement of ALL_ACHIEVEMENTS) {
      // Skip hidden achievements
      if (achievement.isHidden && achievement.isHidden(achievementData)) {
        continue;
      }
      
      // Check if achievement is unlocked
      const isUnlocked = achievement.checkUnlocked(achievementData);
      
      // If unlocked and not previously unlocked, it's new
      if (isUnlocked && !previouslyUnlockedSet.has(achievement.id)) {
        newlyUnlocked.push(achievement);
        // Add to previously unlocked set
        previouslyUnlockedSet.add(achievement.id);
      }
    }

    // Update localStorage with all unlocked achievements
    localStorage.setItem('unlockedAchievements', JSON.stringify(Array.from(previouslyUnlockedSet)));

    return newlyUnlocked;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return [];
  }
}

/**
 * Display achievement notification in eval screen
 * @param {HTMLElement} evalDiv - The eval screen div element
 * @param {Array} achievements - Array of achievement objects to display
 */
export function displayAchievementNotifications(evalDiv, achievements) {
  if (!achievements || achievements.length === 0) {
    return;
  }

  // Create notification container if it doesn't exist
  let notificationContainer = evalDiv.querySelector('.achievement-notifications');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.className = 'achievement-notifications';
    notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 15px;
      max-width: 400px;
      pointer-events: none;
    `;
    document.body.appendChild(notificationContainer);
  }

  // Display each achievement notification
  achievements.forEach((achievement, index) => {
    setTimeout(() => {
      const notification = document.createElement('div');
      notification.className = 'achievement-notification';
      notification.style.cssText = `
        background: linear-gradient(135deg, rgba(255, 215, 0, 0.95) 0%, rgba(255, 140, 0, 0.95) 100%);
        border: 3px solid #ffd700;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 8px 32px rgba(255, 215, 0, 0.6), 0 0 60px rgba(255, 215, 0, 0.4);
        animation: slideInRight 0.5s ease-out;
        pointer-events: auto;
        color: #000;
        font-weight: bold;
      `;
      
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
          <div style="font-size: 3em;">${achievement.icon}</div>
          <div>
            <div style="font-size: 1.2em; margin-bottom: 5px;">Achievement Unlocked!</div>
            <div style="font-size: 1.5em; color: #8b6914;">${achievement.title}</div>
          </div>
        </div>
        <div style="font-size: 1em; color: #8b6914; margin-top: 10px; font-style: italic;">
          ${achievement.unlockedMessage || 'Congratulations!'}
        </div>
      `;

      notificationContainer.appendChild(notification);

      // Add animation keyframes if not already added
      if (!document.getElementById('achievement-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'achievement-notification-styles';
        style.textContent = `
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes slideOutRight {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(style);
      }

      // Auto-remove after 5 seconds
      setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.5s ease-out';
        setTimeout(() => {
          notification.remove();
        }, 500);
      }, 5000);
    }, index * 300); // Stagger notifications
  });
}

