/**
 * InputSystem - Shared Keyboard/Gamepad Input Handling
 * Handles keyboard shortcuts and gamepad navigation for quiz modes.
 */

import { isMobileDevice } from './QuizCore.js';

/**
 * Initialize the input system.
 * @param {Object} options - Configuration options.
 * @param {function} options.onSubmit - Callback when submit is triggered.
 * @param {function} options.onPauseToggle - Callback to toggle pause.
 * @param {function} options.onPauseNavigate - Callback for pause menu navigation.
 * @param {function} options.onPauseSelect - Callback for pause menu selection.
 * @param {function} options.getIsPaused - Function to check if paused.
 * @param {function} options.getAnswerOptions - Function to get answer radio buttons.
 * @param {function} options.isQuizActive - Function to check if quiz is active.
 * @returns {Object} Input system API.
 */
export function initInputSystem(options) {
    const {
        onSubmit = () => { },
        onPauseToggle = () => { },
        onPauseNavigate = () => { },
        onPauseSelect = () => { },
        getIsPaused = () => false,
        getAnswerOptions = () => [],
        isQuizActive = () => true
    } = options;

    const isMobile = isMobileDevice();
    let inputType = isMobile ? 'mobile' : 'mouse';
    let gamepadConnected = false;
    let gamepadPollInterval = null;
    let lastDpadState = { up: false, down: false, left: false, right: false };
    let lastButtonState = { a: false, x: false, start: false };

    // Keyboard handler
    function handleKeydown(e) {
        // Track keyboard input type
        if (inputType !== 'controller' && !isMobile) {
            inputType = 'keyboard';
        }

        // Pause with Escape key
        if (e.key === 'Escape') {
            const evalDiv = document.querySelector('.evalscreen');
            if (!evalDiv || evalDiv.style.display === 'none' || evalDiv.style.display === '') {
                onPauseToggle();
                e.preventDefault();
            }
            return;
        }

        // Handle pause menu navigation
        if (getIsPaused()) {
            const pauseMenu = document.getElementById('pauseMenu');
            if (pauseMenu && pauseMenu.style.display !== 'none') {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    onPauseNavigate(e.key === 'ArrowUp' ? 'up' : 'down');
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPauseSelect();
                }
            }
            return;
        }

        // Don't process input if quiz isn't active
        if (!isQuizActive()) {
            return;
        }

        // Number keys 1-4 for answer selection
        if (e.key >= '1' && e.key <= '4') {
            const index = parseInt(e.key) - 1;
            const options = getAnswerOptions();
            if (options && options[index]) {
                options[index].checked = true;
                e.preventDefault();
            }
        }

        // Space or Enter to submit
        if (e.key === ' ' || e.key === 'Enter') {
            const submitBtn = document.getElementById('btn');
            if (submitBtn && submitBtn.style.display !== 'none') {
                onSubmit();
                e.preventDefault();
            }
        }
    }

    // Gamepad polling
    function pollGamepad() {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                handleGamepadInput(gamepads[i]);
                break;
            }
        }
    }

    function handleGamepadInput(gamepad) {
        inputType = 'controller';

        // Start button (button 9) for pause
        const startPressed = gamepad.buttons[9]?.pressed || false;
        if (startPressed && !lastButtonState.start) {
            onPauseToggle();
        }
        lastButtonState.start = startPressed;

        // Handle pause menu navigation
        if (getIsPaused()) {
            // D-pad navigation
            const dpadUp = gamepad.buttons[12]?.pressed || (gamepad.axes[1] < -0.5);
            const dpadDown = gamepad.buttons[13]?.pressed || (gamepad.axes[1] > 0.5);

            if (dpadUp && !lastDpadState.up) {
                onPauseNavigate('up');
            }
            if (dpadDown && !lastDpadState.down) {
                onPauseNavigate('down');
            }

            lastDpadState.up = dpadUp;
            lastDpadState.down = dpadDown;

            // A button to select
            const aPressed = gamepad.buttons[0]?.pressed || false;
            if (aPressed && !lastButtonState.a) {
                onPauseSelect();
            }
            lastButtonState.a = aPressed;
            return;
        }

        // Don't process if quiz isn't active
        if (!isQuizActive()) {
            return;
        }

        // D-pad for answer selection
        const dpadUp = gamepad.buttons[12]?.pressed || false;
        const dpadDown = gamepad.buttons[13]?.pressed || false;
        const dpadLeft = gamepad.buttons[14]?.pressed || false;
        const dpadRight = gamepad.buttons[15]?.pressed || false;

        const options = getAnswerOptions();

        // Map D-pad to options (Up=0, Right=1, Down=2, Left=3)
        if (dpadUp && !lastDpadState.up && options[0]) {
            options[0].checked = true;
        }
        if (dpadRight && !lastDpadState.right && options[1]) {
            options[1].checked = true;
        }
        if (dpadDown && !lastDpadState.down && options[2]) {
            options[2].checked = true;
        }
        if (dpadLeft && !lastDpadState.left && options[3]) {
            options[3].checked = true;
        }

        lastDpadState = { up: dpadUp, down: dpadDown, left: dpadLeft, right: dpadRight };

        // A or X button to submit
        const aPressed = gamepad.buttons[0]?.pressed || false;
        const xPressed = gamepad.buttons[2]?.pressed || false;

        if ((aPressed && !lastButtonState.a) || (xPressed && !lastButtonState.x)) {
            onSubmit();
        }

        lastButtonState.a = aPressed;
        lastButtonState.x = xPressed;
    }

    // Initialize
    function init() {
        document.addEventListener('keydown', handleKeydown);

        window.addEventListener('gamepadconnected', () => {
            gamepadConnected = true;
            inputType = 'controller';
            if (!gamepadPollInterval) {
                gamepadPollInterval = setInterval(pollGamepad, 50);
            }
            updateControllerIndicators(true);
        });

        window.addEventListener('gamepaddisconnected', () => {
            gamepadConnected = false;
            if (gamepadPollInterval) {
                clearInterval(gamepadPollInterval);
                gamepadPollInterval = null;
            }
            updateControllerIndicators(false);
        });

        // Check for already connected gamepad
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                gamepadConnected = true;
                inputType = 'controller';
                gamepadPollInterval = setInterval(pollGamepad, 50);
                break;
            }
        }
    }

    // Update controller/keyboard indicators visibility
    function updateControllerIndicators(showController) {
        const controllerIndicators = document.querySelectorAll('.controller-indicator');
        const keyboardIndicators = document.querySelectorAll('.keyboard-indicator');

        controllerIndicators.forEach(el => {
            el.style.display = showController && !isMobile ? 'inline-block' : 'none';
        });

        keyboardIndicators.forEach(el => {
            el.style.display = !showController && !isMobile ? 'inline-block' : 'none';
        });
    }

    // Return API
    return {
        init,
        getInputType: () => inputType,
        isGamepadConnected: () => gamepadConnected,
        updateControllerIndicators
    };
}

