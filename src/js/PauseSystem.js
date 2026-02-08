/**
 * PauseSystem - Shared Pause Menu Logic
 * Handles pause menu display, navigation, and game state.
 */

/**
 * Initialize the pause system.
 * @param {Object} options - Configuration options.
 * @param {function} options.onPause - Callback when game is paused.
 * @param {function} options.onResume - Callback when game is resumed.
 * @param {function} options.onGiveUp - Callback when player gives up.
 * @param {function} options.getIsPaused - Function to get pause state.
 * @param {function} options.setIsPaused - Function to set pause state.
 * @returns {Object} Pause system API.
 */
export function initPauseSystem(options) {
    const {
        onPause = () => { },
        onResume = () => { },
        onGiveUp = () => { },
        getIsPaused = () => false,
        setIsPaused = () => { }
    } = options;

    // State
    let pauseStartTime = 0;
    let pauseCount = 0;
    let totalPausedTime = 0;
    let selectedPauseButton = 0;

    // DOM elements
    const pauseMenu = document.getElementById('pauseMenu');
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const giveUpPauseBtn = document.getElementById('giveUpPauseBtn');
    const pauseCountDisplay = document.getElementById('pauseCountDisplay');
    const totalPausedTimeDisplay = document.getElementById('totalPausedTimeDisplay');
    const pauseButtons = [resumeBtn, giveUpPauseBtn];

    // Format paused time for display
    function formatPausedTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const centiseconds = Math.floor((ms % 1000) / 10);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${centiseconds.toString().padStart(2, '0')}`;
    }

    // Update pause menu display
    function updatePauseMenuDisplay() {
        if (pauseCountDisplay) {
            pauseCountDisplay.textContent = pauseCount || 0;
        }
        if (totalPausedTimeDisplay) {
            totalPausedTimeDisplay.textContent = formatPausedTime(totalPausedTime || 0);
        }
    }

    // Update pause button highlighting
    function updatePauseButtonHighlight() {
        pauseButtons.forEach((btn, index) => {
            if (btn) {
                if (index === selectedPauseButton) {
                    btn.classList.add('pause-button-selected');
                    btn.focus();
                } else {
                    btn.classList.remove('pause-button-selected');
                }
            }
        });
    }

    // Pause the game
    function pauseGame() {
        if (getIsPaused()) return;

        // Check if eval screen is showing
        const evalDiv = document.querySelector('.evalscreen');
        if (evalDiv && evalDiv.style.display !== 'none' && evalDiv.style.display !== '') {
            return;
        }

        setIsPaused(true);
        pauseStartTime = Date.now();
        pauseCount++;

        onPause();

        // Show pause menu
        if (pauseMenu) {
            pauseMenu.style.display = 'flex';
            updatePauseMenuDisplay();
            selectedPauseButton = 0;
            updatePauseButtonHighlight();

            // Update pause display periodically
            if (window.pauseDisplayInterval) {
                clearInterval(window.pauseDisplayInterval);
            }
            window.pauseDisplayInterval = setInterval(() => {
                if (getIsPaused() && pauseMenu && pauseMenu.style.display !== 'none') {
                    const currentPauseTime = Date.now() - pauseStartTime;
                    const totalTime = totalPausedTime + currentPauseTime;
                    if (totalPausedTimeDisplay) {
                        totalPausedTimeDisplay.textContent = formatPausedTime(totalTime);
                    }
                } else {
                    if (window.pauseDisplayInterval) {
                        clearInterval(window.pauseDisplayInterval);
                        window.pauseDisplayInterval = null;
                    }
                }
            }, 100);
        }

        // Disable game interaction
        const container = document.querySelector('.container');
        if (container) {
            container.style.pointerEvents = 'none';
            container.style.opacity = '0.5';
        }
    }

    // Resume the game
    function resumeGame() {
        if (!getIsPaused()) return;

        setIsPaused(false);
        const pauseDuration = Date.now() - pauseStartTime;
        totalPausedTime += pauseDuration;

        onResume(pauseDuration);

        // Hide pause menu
        if (pauseMenu) {
            pauseMenu.style.display = 'none';
        }

        // Clear pause display interval
        if (window.pauseDisplayInterval) {
            clearInterval(window.pauseDisplayInterval);
            window.pauseDisplayInterval = null;
        }

        // Re-enable game interaction
        const container = document.querySelector('.container');
        if (container) {
            container.style.pointerEvents = 'auto';
            container.style.opacity = '1';
        }
    }

    // Toggle pause
    function togglePause() {
        if (getIsPaused()) {
            resumeGame();
        } else {
            pauseGame();
        }
    }

    // Handle pause menu button selection
    function selectPauseButton() {
        if (selectedPauseButton === 0 && resumeBtn) {
            togglePause();
        } else if (selectedPauseButton === 1 && giveUpPauseBtn) {
            if (confirm('Are you sure you want to give up?')) {
                onGiveUp();
            }
        }
    }

    // Navigate pause menu
    function navigatePauseMenu(direction) {
        if (direction === 'up' || direction === 'down') {
            selectedPauseButton = selectedPauseButton === 0 ? 1 : 0;
            updatePauseButtonHighlight();
        }
    }

    // Set up pause button
    if (pauseBtn) {
        pauseBtn.style.display = 'block';
        pauseBtn.style.position = 'fixed';
        pauseBtn.style.top = '140px';
        pauseBtn.style.right = '20px';
        pauseBtn.style.zIndex = '9999';
        pauseBtn.style.padding = '10px 20px';
        pauseBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        pauseBtn.style.color = 'white';
        pauseBtn.style.border = '2px solid white';
        pauseBtn.style.borderRadius = '5px';
        pauseBtn.style.cursor = 'pointer';
        pauseBtn.style.fontSize = '1em';
        pauseBtn.addEventListener('click', togglePause);
    }

    // Set up menu buttons
    if (resumeBtn) {
        resumeBtn.addEventListener('click', togglePause);
        resumeBtn.addEventListener('mouseenter', () => {
            selectedPauseButton = 0;
            updatePauseButtonHighlight();
        });
    }

    if (giveUpPauseBtn) {
        giveUpPauseBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to give up?')) {
                onGiveUp();
            }
        });
        giveUpPauseBtn.addEventListener('mouseenter', () => {
            selectedPauseButton = 1;
            updatePauseButtonHighlight();
        });
    }

    // Return API
    return {
        pauseGame,
        resumeGame,
        togglePause,
        selectPauseButton,
        navigatePauseMenu,
        getPauseCount: () => pauseCount,
        getTotalPausedTime: () => totalPausedTime,
        getSelectedButton: () => selectedPauseButton
    };
}

