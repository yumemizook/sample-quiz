/**
 * Game Configuration Module
 * Centralizes all game mode settings and rules.
 */

export const MODES = {
    easy: {
        name: 'Easy',
        difficulty: 'easy',
        questionCount: 30,
        background: 'easy.jpg',
        themeColor: '#adffcd',
        textColor: 'rgb(104, 104, 104)',
        apiUrl: 'https://opentdb.com/api.php?amount=30&difficulty=easy',
        firestoreCollection: 'easy'
    },
    normal: {
        name: 'Normal',
        difficulty: 'medium',
        questionCount: 100,
        background: 'normal.jpg',
        themeColor: '#dbffff',
        textColor: 'rgb(104, 104, 104)',
        apiUrl: 'https://opentdb.com/api.php?amount=50&difficulty=medium',
        firestoreCollection: 'normal'
    },
    master: {
        name: 'Master',
        difficulty: 'hard',
        questionCount: 130,
        background: 'master.jpg',
        themeColor: '#ffe066',
        textColor: 'rgb(80, 80, 80)',
        apiUrl: 'https://opentdb.com/api.php?amount=50&difficulty=hard',
        firestoreCollection: 'master'
    },
    hell: {
        name: 'Hell',
        difficulty: 'hard',
        questionCount: 200,
        background: 'hell1.jpg',
        themeColor: '#ff6b6b',
        textColor: 'rgb(50, 50, 50)',
        apiUrl: 'https://opentdb.com/api.php?amount=50&difficulty=hard',
        firestoreCollection: 'hell'
    },
    master130: {
        name: 'Race',
        difficulty: 'hard',
        questionCount: 130,
        background: 'race.jpg',
        themeColor: '#a29bfe',
        textColor: 'rgb(60, 60, 60)',
        apiUrl: 'https://opentdb.com/api.php?amount=50&difficulty=hard',
        firestoreCollection: 'race'
    },
    'easy-race': {
        name: 'Easy Race',
        difficulty: 'easy',
        questionCount: 30,
        background: 'race.jpg',
        themeColor: '#74b9ff',
        textColor: 'rgb(60, 60, 60)',
        apiUrl: 'https://opentdb.com/api.php?amount=30&difficulty=easy',
        firestoreCollection: 'easyrace'
    },
    'hard-race': {
        name: 'Hard Race',
        difficulty: 'hard',
        questionCount: 200,
        background: 'race.jpg',
        themeColor: '#fd79a8',
        textColor: 'rgb(60, 60, 60)',
        apiUrl: 'https://opentdb.com/api.php?amount=50&difficulty=hard',
        firestoreCollection: 'hardrace'
    },
    death: {
        name: 'Death',
        difficulty: 'hard',
        questionCount: 200,
        background: 'hell3.jpg',
        themeColor: '#e74c3c',
        textColor: 'rgb(40, 40, 40)',
        apiUrl: 'https://opentdb.com/api.php?amount=50&difficulty=hard',
        firestoreCollection: 'death'
    },
    secret: {
        name: 'Secret',
        difficulty: 'hard',
        questionCount: 200,
        background: null, // Secret mode uses black background
        themeColor: '#ffffff',
        textColor: 'rgb(200, 200, 200)',
        apiUrl: 'https://opentdb.com/api.php?amount=50&difficulty=hard',
        firestoreCollection: 'secret'
    }
};

/**
 * Get mode configuration by mode ID.
 * @param {string} modeId - The mode identifier (e.g., 'easy', 'normal', 'master').
 * @returns {object} The mode configuration object, or default 'normal'.
 */
export function getModeConfig(modeId) {
    return MODES[modeId] || MODES.normal;
}

/**
 * Get the mode ID from the current URL query parameter.
 * @returns {string} The mode ID from URL or 'normal' as default.
 */
export function getModeFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mode') || 'normal';
}

/**
 * Build URL parameters for a game mode.
 * @param {string} modeId - The mode identifier.
 * @param {object} settings - Optional settings (lives, timeMultiplier, etc.).
 * @returns {string} The query string for the URL.
 */
export function buildGameUrl(modeId, settings = {}) {
    const params = new URLSearchParams();
    params.set('mode', modeId);

    if (settings.lives && settings.lives !== 'unlimited') {
        params.set('lives', settings.lives);
    }
    if (settings.timeMultiplier && settings.timeMultiplier !== 1) {
        params.set('timeMultiplier', settings.timeMultiplier.toString());
    }
    if (settings.fading && settings.fading !== 'off') {
        params.set('fading', settings.fading);
    }
    if (settings.start && settings.start > 0) {
        params.set('start', settings.start.toString());
    }
    if (settings.bgmSet) {
        params.set('bgmSet', settings.bgmSet);
    }

    return `game.html?${params.toString()}`;
}

