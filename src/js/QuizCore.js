/**
 * QuizCore - Shared Quiz Utilities
 * Common functionality used by all game modes.
 */

/**
 * Fetch questions from OpenTDB API with retry logic.
 * @param {number} totalQuestions - Total number of questions to fetch.
 * @param {string} difficulty - Difficulty level ('easy', 'medium', 'hard').
 * @param {function} onProgress - Callback for progress updates.
 * @returns {Promise<Array>} Array of question objects.
 */
export async function fetchQuestions(totalQuestions, difficulty, onProgress) {
    const questionsPerRequest = 50;
    const numRequests = Math.ceil(totalQuestions / questionsPerRequest);
    const maxRetries = 3;

    const allQuestions = [];
    let failedRequests = 0;

    for (let i = 0; i < numRequests; i++) {
        // Update progress
        const progress = Math.floor(((i + 1) / numRequests) * 100);
        if (onProgress) onProgress(progress);

        // Add delay between API calls to prevent rate limiting
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const amount = (i === numRequests - 1)
            ? totalQuestions - i * questionsPerRequest
            : questionsPerRequest;

        let requestSuccess = false;
        let retryCount = 0;

        while (!requestSuccess && retryCount < maxRetries) {
            try {
                const response = await fetch(
                    `https://opentdb.com/api.php?amount=${amount}&difficulty=${difficulty}`
                );

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.response_code && data.response_code !== 0) {
                    throw new Error(`API Error Code: ${data.response_code}`);
                }

                if (data.results && data.results.length > 0) {
                    allQuestions.push(...data.results);
                    requestSuccess = true;
                } else {
                    throw new Error('No results in response');
                }
            } catch (requestError) {
                retryCount++;
                if (retryCount < maxRetries) {
                    console.warn(`Request ${i + 1} attempt ${retryCount} failed: ${requestError.message}. Retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                } else {
                    console.error(`Request ${i + 1} failed after ${maxRetries} attempts: ${requestError.message}`);
                    failedRequests++;
                }
            }
        }
    }

    if (allQuestions.length === 0) {
        throw new Error('Failed to fetch any questions. Please try again.');
    }

    console.log(`Successfully loaded ${allQuestions.length} out of ${totalQuestions} requested questions.`);
    return allQuestions;
}

/**
 * Decode HTML entities in text.
 * @param {string} text - Text with HTML entities.
 * @returns {string} Decoded text.
 */
export function decodeHTMLEntities(text) {
    if (!text) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = text;
    return txt.value;
}

/**
 * Shuffle an array using Fisher-Yates algorithm.
 * @param {Array} array - Array to shuffle.
 * @returns {Array} Shuffled array (mutates original).
 */
export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Format milliseconds as MM:SS:CC.
 * @param {number} ms - Milliseconds.
 * @returns {string} Formatted time string.
 */
export function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${centiseconds.toString().padStart(2, '0')}`;
}

/**
 * Get audio volume from localStorage (0-1 range).
 * @returns {number} Volume level.
 */
export function getAudioVolume() {
    const savedVolume = localStorage.getItem('audioVolume');
    const volume = savedVolume !== null ? parseInt(savedVolume) : 100;
    return volume / 100;
}

/**
 * Check if the device is mobile.
 * @returns {boolean} True if mobile device.
 */
export function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
}

