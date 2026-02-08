/**
 * Input Manager Module
 * Handles keyboard and gamepad input for the game.
 */

export class InputManager {
    constructor(gameManager, uiManager) {
        this.gameManager = gameManager;
        this.uiManager = uiManager;

        this.gamepadConnected = false;
        this.gamepadPollInterval = null;
        this.lastDpadState = { up: false, down: false, left: false, right: false };
        this.lastButtonState = { a: false, x: false };
        this.inputType = this.isMobileDevice() ? 'mobile' : 'mouse';

        this.onSubmit = null; // Callback when submit is pressed
        this.onPause = null;  // Callback when pause is pressed
    }

    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    }

    /**
     * Initialize all input listeners.
     */
    init() {
        this.initKeyboard();
        this.initGamepad();
    }

    /**
     * Initialize keyboard input.
     */
    initKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Track input type
            if (this.inputType !== 'controller' && !this.isMobileDevice()) {
                this.inputType = 'keyboard';
            }

            // Pause with Escape
            if (e.key === 'Escape') {
                if (this.onPause) {
                    this.onPause();
                    e.preventDefault();
                }
                return;
            }

            // Skip other inputs if game is paused
            if (this.gameManager.isPaused) {
                return;
            }

            // Number keys (1-4) to select answers
            if (e.key >= '1' && e.key <= '4') {
                const index = parseInt(e.key) - 1;
                if (this.uiManager.answerOptions && this.uiManager.answerOptions[index]) {
                    this.uiManager.answerOptions[index].checked = true;
                    e.preventDefault();
                }
            }

            // Space or Enter to submit
            if (e.key === ' ' || e.key === 'Enter') {
                if (this.onSubmit) {
                    this.onSubmit();
                    e.preventDefault();
                }
            }
        });
    }

    /**
     * Initialize gamepad input.
     */
    initGamepad() {
        window.addEventListener('gamepadconnected', () => {
            this.gamepadConnected = true;
            this.inputType = 'controller';
            this.startGamepadPolling();
        });

        window.addEventListener('gamepaddisconnected', () => {
            this.gamepadConnected = false;
            this.stopGamepadPolling();
        });

        // Check for already connected gamepads
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                this.gamepadConnected = true;
                this.inputType = 'controller';
                this.startGamepadPolling();
                break;
            }
        }
    }

    startGamepadPolling() {
        if (this.gamepadPollInterval) return;

        this.gamepadPollInterval = setInterval(() => {
            const gamepads = navigator.getGamepads();
            for (let i = 0; i < gamepads.length; i++) {
                if (gamepads[i]) {
                    this.handleGamepadInput(gamepads[i]);
                    break;
                }
            }
        }, 50);
    }

    stopGamepadPolling() {
        if (this.gamepadPollInterval) {
            clearInterval(this.gamepadPollInterval);
            this.gamepadPollInterval = null;
        }
    }

    handleGamepadInput(gamepad) {
        // Start button (button 9) for pause
        if (gamepad.buttons[9]?.pressed) {
            if (!this.lastButtonState.start) {
                this.lastButtonState.start = true;
                if (this.onPause) this.onPause();
            }
        } else {
            this.lastButtonState.start = false;
        }

        // Skip other inputs if paused
        if (this.gameManager.isPaused) return;

        // D-pad for answer selection
        let dpadUp = gamepad.buttons[12]?.pressed || false;
        let dpadDown = gamepad.buttons[13]?.pressed || false;

        // Analog stick as alternative
        const leftStickY = gamepad.axes[1] || 0;
        if (Math.abs(leftStickY) > 0.5) {
            if (leftStickY < -0.5) dpadUp = true;
            if (leftStickY > 0.5) dpadDown = true;
        }

        // Navigate options with D-pad
        if (dpadUp && !this.lastDpadState.up) {
            this.selectPreviousOption();
            this.lastDpadState.up = true;
        } else if (!dpadUp) {
            this.lastDpadState.up = false;
        }

        if (dpadDown && !this.lastDpadState.down) {
            this.selectNextOption();
            this.lastDpadState.down = true;
        } else if (!dpadDown) {
            this.lastDpadState.down = false;
        }

        // A button (button 0) or X button (button 2) to submit
        const aPressed = gamepad.buttons[0]?.pressed || false;
        const xPressed = gamepad.buttons[2]?.pressed || false;

        if ((aPressed || xPressed) && !this.lastButtonState.a && !this.lastButtonState.x) {
            if (this.onSubmit) this.onSubmit();
            this.lastButtonState.a = aPressed;
            this.lastButtonState.x = xPressed;
        } else {
            this.lastButtonState.a = aPressed;
            this.lastButtonState.x = xPressed;
        }
    }

    selectNextOption() {
        const options = this.uiManager.answerOptions;
        if (!options || options.length === 0) return;

        const currentIndex = options.findIndex(opt => opt.checked);
        const nextIndex = (currentIndex + 1) % options.length;
        options[nextIndex].checked = true;
    }

    selectPreviousOption() {
        const options = this.uiManager.answerOptions;
        if (!options || options.length === 0) return;

        const currentIndex = options.findIndex(opt => opt.checked);
        const prevIndex = currentIndex <= 0 ? options.length - 1 : currentIndex - 1;
        options[prevIndex].checked = true;
    }
}

