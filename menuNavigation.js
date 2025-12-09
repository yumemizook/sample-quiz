/**
 * Menu Navigation System
 * Handles keyboard and controller navigation for the main menu
 */

// Navigation state
let currentFocus = {
    type: 'mode', // 'mode', 'button', or 'settings'
    index: 1 // Default to normal mode (index 1)
};

// Navigation items
let modeCards = [];
let menuButtons = [];
let settingsItems = [];

// Gamepad state
let gamepadConnected = false;
let gamepadPollInterval = null;
let lastDpadState = { up: false, down: false, left: false, right: false };
let lastButtonState = { a: false, x: false };

/**
 * Initialize menu navigation
 */
export function initMenuNavigation() {
    // Get navigation elements
    modeCards = Array.from(document.querySelectorAll(".mode-card"));
    menuButtons = [
        document.querySelector(".play-btn"),
        document.querySelector(".hiscore"),
        document.querySelector(".stats"),
        document.querySelector(".wiki"),
        document.querySelector(".tos"),
        document.querySelector(".privacy"),
        document.querySelector(".settings")
    ].filter(btn => btn !== null);

    // Get settings items
    updateSettingsItems();

    // Find the initially active mode card
    const activeCard = modeCards.find(card => card.classList.contains("active"));
    if (activeCard) {
        currentFocus.index = modeCards.indexOf(activeCard);
    }

    // Set initial focus
    updateFocus();

    // Initialize keyboard navigation
    initKeyboardNavigation();

    // Initialize gamepad navigation
    initGamepadNavigation();
}

/**
 * Update settings items list (called when settings visibility changes)
 */
export function updateSettingsItems() {
    const modeSettings = document.getElementById("modeSettings");
    if (modeSettings && modeSettings.style.display !== "none") {
        settingsItems = [
            document.querySelector('[data-setting="lives"]'),
            document.getElementById("timeMultiplier"),
            document.querySelector('[data-setting="fadingMode"]'),
            document.querySelector('[data-setting="startQuestion"]')
        ].filter(item => item !== null);
    } else {
        settingsItems = [];
    }
}

// Make it available globally for index.html
window.updateSettingsItems = updateSettingsItems;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenuNavigation);
} else {
    // DOM is already ready
    initMenuNavigation();
}

/**
 * Initialize keyboard navigation
 */
function initKeyboardNavigation() {
    document.addEventListener("keydown", (e) => {
        // Prevent default behavior for navigation keys
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "].includes(e.key)) {
            e.preventDefault();
        }

        switch (e.key) {
            case "ArrowLeft":
                navigateLeft();
                break;
            case "ArrowRight":
                navigateRight();
                break;
            case "ArrowUp":
                navigateUp();
                break;
            case "ArrowDown":
                navigateDown();
                break;
            case "Enter":
            case " ":
                activateCurrent();
                break;
        }
    });
}

/**
 * Initialize gamepad navigation
 */
function initGamepadNavigation() {
    window.addEventListener("gamepadconnected", (e) => {
        gamepadConnected = true;
        startGamepadPolling();
    });

    window.addEventListener("gamepaddisconnected", (e) => {
        gamepadConnected = false;
        stopGamepadPolling();
    });

    // Check for already connected gamepads
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            gamepadConnected = true;
            startGamepadPolling();
            break;
        }
    }
}

/**
 * Start polling gamepad input
 */
function startGamepadPolling() {
    if (gamepadPollInterval) return;
    
    gamepadPollInterval = setInterval(() => {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                handleGamepadInput(gamepad);
                break;
            }
        }
    }, 50);
}

/**
 * Stop polling gamepad input
 */
function stopGamepadPolling() {
    if (gamepadPollInterval) {
        clearInterval(gamepadPollInterval);
        gamepadPollInterval = null;
    }
}

/**
 * Handle gamepad input
 */
function handleGamepadInput(gamepad) {
    // D-pad buttons (buttons 12-15)
    let dpadUp = gamepad.buttons[12]?.pressed || false;
    let dpadDown = gamepad.buttons[13]?.pressed || false;
    let dpadLeft = gamepad.buttons[14]?.pressed || false;
    let dpadRight = gamepad.buttons[15]?.pressed || false;

    // Check analog stick (axes 0 and 1)
    const leftStickX = gamepad.axes[0] || 0;
    const leftStickY = gamepad.axes[1] || 0;
    
    // Use stick if D-pad is not pressed
    if (!dpadLeft && !dpadRight && Math.abs(leftStickX) > 0.5) {
        if (leftStickX < -0.5) dpadLeft = true;
        if (leftStickX > 0.5) dpadRight = true;
    }
    
    if (!dpadUp && !dpadDown && Math.abs(leftStickY) > 0.5) {
        if (leftStickY < -0.5) dpadUp = true;
        if (leftStickY > 0.5) dpadDown = true;
    }

    // Handle D-pad navigation (only on state change)
    if (dpadLeft && !lastDpadState.left) {
        navigateLeft();
        lastDpadState.left = true;
    } else if (!dpadLeft) {
        lastDpadState.left = false;
    }

    if (dpadRight && !lastDpadState.right) {
        navigateRight();
        lastDpadState.right = true;
    } else if (!dpadRight) {
        lastDpadState.right = false;
    }

    if (dpadUp && !lastDpadState.up) {
        navigateUp();
        lastDpadState.up = true;
    } else if (!dpadUp) {
        lastDpadState.up = false;
    }

    if (dpadDown && !lastDpadState.down) {
        navigateDown();
        lastDpadState.down = true;
    } else if (!dpadDown) {
        lastDpadState.down = false;
    }

    // Handle A button (button 0) and X button (button 2)
    const aPressed = gamepad.buttons[0]?.pressed || false;
    const xPressed = gamepad.buttons[2]?.pressed || false;

    if ((aPressed || xPressed) && !lastButtonState.a && !lastButtonState.x) {
        activateCurrent();
        lastButtonState.a = aPressed;
        lastButtonState.x = xPressed;
    } else {
        lastButtonState.a = aPressed;
        lastButtonState.x = xPressed;
    }
}

/**
 * Navigate left
 */
function navigateLeft() {
    if (currentFocus.type === 'mode') {
        if (currentFocus.index > 0) {
            currentFocus.index--;
            updateFocus();
        }
    } else if (currentFocus.type === 'button') {
        // From buttons, go back to modes
        currentFocus.type = 'mode';
        currentFocus.index = 1; // Default to normal
        updateFocus();
    } else if (currentFocus.type === 'settings') {
        // Adjust current setting value to the left/previous option
        adjustSettingValue('left');
    }
}

/**
 * Navigate right
 */
function navigateRight() {
    if (currentFocus.type === 'mode') {
        if (currentFocus.index < modeCards.length - 1) {
            currentFocus.index++;
            updateFocus();
        }
    } else if (currentFocus.type === 'button') {
        // From buttons, go back to modes
        currentFocus.type = 'mode';
        currentFocus.index = 1; // Default to normal
        updateFocus();
    } else if (currentFocus.type === 'settings') {
        // Adjust current setting value to the right/next option
        adjustSettingValue('right');
    }
}

/**
 * Navigate up
 */
function navigateUp() {
    if (currentFocus.type === 'button') {
        // From buttons, go to modes
        currentFocus.type = 'mode';
        currentFocus.index = 1; // Default to normal
        updateFocus();
    } else if (currentFocus.type === 'settings') {
        // Move to previous setting
        if (currentFocus.index > 0) {
            currentFocus.index--;
            updateFocus();
        } else {
            // Go back to mode selection
            currentFocus.type = 'mode';
            currentFocus.index = 1;
            updateFocus();
        }
    }
}

/**
 * Navigate down
 */
function navigateDown() {
    if (currentFocus.type === 'mode') {
        // From modes, check if settings are available
        updateSettingsItems();
        if (settingsItems.length > 0) {
            // Expand settings section if collapsed
            const modeSettings = document.getElementById("modeSettings");
            if (modeSettings && modeSettings.classList.contains("collapsed")) {
                modeSettings.classList.remove("collapsed");
                // Re-update settings items after expanding
                setTimeout(() => {
                    updateSettingsItems();
                    if (settingsItems.length > 0) {
                        currentFocus.type = 'settings';
                        currentFocus.index = 0;
                        updateFocus();
                    }
                }, 100);
            } else {
                // Go to settings
                currentFocus.type = 'settings';
                currentFocus.index = 0;
                updateFocus();
            }
        } else {
            // No settings available, go to buttons
            currentFocus.type = 'button';
            currentFocus.index = 0; // Start with Play button
            updateFocus();
        }
    } else if (currentFocus.type === 'button') {
        if (currentFocus.index < menuButtons.length - 1) {
            currentFocus.index++;
            updateFocus();
        }
    } else if (currentFocus.type === 'settings') {
        // Move to next setting
        if (currentFocus.index < settingsItems.length - 1) {
            currentFocus.index++;
            updateFocus();
        } else {
            // Go to buttons
            currentFocus.type = 'button';
            currentFocus.index = 0;
            updateFocus();
        }
    }
}

/**
 * Activate current focused item
 */
function activateCurrent() {
    if (currentFocus.type === 'mode') {
        const card = modeCards[currentFocus.index];
        if (card) {
            // Trigger click to update mode selection and styling
            card.click();
        }
    } else if (currentFocus.type === 'button') {
        const button = menuButtons[currentFocus.index];
        if (button) {
            // Trigger click to navigate to the appropriate page
            button.click();
        }
    }
}

/**
 * Update visual focus
 */
function updateFocus() {
    // Remove focus from all items
    modeCards.forEach(card => {
        card.classList.remove("keyboard-focus");
    });
    menuButtons.forEach(button => {
        if (button) {
            button.classList.remove("keyboard-focus");
        }
    });
    settingsItems.forEach(item => {
        if (item) {
            item.classList.remove("keyboard-focus");
            // Also remove from parent setting-item
            const settingItem = item.closest('.setting-item');
            if (settingItem) {
                settingItem.classList.remove("keyboard-focus");
            }
        }
    });

    // Add focus to current item
    if (currentFocus.type === 'mode') {
        const card = modeCards[currentFocus.index];
        if (card) {
            card.classList.add("keyboard-focus");
            // Scroll into view if needed
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    } else if (currentFocus.type === 'button') {
        const button = menuButtons[currentFocus.index];
        if (button) {
            button.classList.add("keyboard-focus");
            // Scroll into view if needed
            button.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    } else if (currentFocus.type === 'settings') {
        const setting = settingsItems[currentFocus.index];
        if (setting) {
            setting.classList.add("keyboard-focus");
            // Also add to parent setting-item for better visibility
            const settingItem = setting.closest('.setting-item');
            if (settingItem) {
                settingItem.classList.add("keyboard-focus");
            }
            // Scroll into view if needed
            setting.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

/**
 * Adjust setting value (left/right for arrow selectors and slider)
 */
function adjustSettingValue(direction) {
    const setting = settingsItems[currentFocus.index];
    if (!setting) return;

    // Check if it's an arrow selector
    const arrowSelector = setting.closest('[data-setting]');
    if (arrowSelector) {
        const settingName = arrowSelector.getAttribute('data-setting');
        const select = document.getElementById(settingName);
        const valueElement = document.getElementById(settingName === 'lives' ? 'livesValue' : 
                                                      settingName === 'fadingMode' ? 'fadingModeValue' : 
                                                      'startQuestionValue');
        
        if (select && valueElement) {
            const options = Array.from(select.options);
            const currentIndex = select.selectedIndex;
            let newIndex;
            
            if (direction === 'right') {
                newIndex = (currentIndex + 1) % options.length;
            } else {
                newIndex = (currentIndex - 1 + options.length) % options.length;
            }
            
            select.selectedIndex = newIndex;
            const selectedOption = select.options[newIndex];
            valueElement.textContent = selectedOption.textContent;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    } else if (setting.id === 'timeMultiplier') {
        // It's the time multiplier slider
        const slider = setting;
        const currentValue = parseFloat(slider.value);
        const step = parseFloat(slider.step);
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        
        let newValue;
        if (direction === 'right') {
            newValue = Math.min(max, currentValue + step);
        } else {
            newValue = Math.max(min, currentValue - step);
        }
        
        slider.value = newValue;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

/**
 * Update focus when mode cards are clicked (to sync with mouse clicks)
 */
export function syncModeSelection(selectedIndex) {
    currentFocus.type = 'mode';
    currentFocus.index = selectedIndex;
    updateFocus();
}

