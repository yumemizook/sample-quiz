/**
 * ModifierIcons - Shared Modifier Display System
 * Shows icons for active modifiers (lives, time multiplier, fading, etc.)
 */

/**
 * Update the modifier icons display.
 * @param {Object} options - Configuration options.
 * @param {boolean} options.livesEnabled - Whether lives system is enabled.
 * @param {number} options.currentLives - Current number of lives.
 * @param {number} options.startQuestion - Starting question number (0-indexed).
 * @param {number} options.timeMultiplier - Time multiplier value.
 * @param {string} options.fadingMode - Fading mode value ('off' or seconds).
 */
export function updateModifierIconsDisplay(options) {
    const {
        livesEnabled = false,
        currentLives = -1,
        startQuestion = 0,
        timeMultiplier = 1,
        fadingMode = 'off'
    } = options;

    const modifierIconsContainer = document.getElementById('modifierIcons');
    if (!modifierIconsContainer) return;

    // Get pause button height to match icon size
    const pauseBtnElement = document.getElementById('pauseBtn');
    let iconSize = 60;
    if (pauseBtnElement && pauseBtnElement.offsetHeight > 0) {
        iconSize = pauseBtnElement.offsetHeight * 1.3;
    }

    // Position container below pause button
    if (pauseBtnElement) {
        const pauseBtnTop = pauseBtnElement.offsetTop || 140;
        const pauseBtnHeight = pauseBtnElement.offsetHeight || 45;
        modifierIconsContainer.style.top = `${pauseBtnTop + pauseBtnHeight + 8}px`;
        modifierIconsContainer.style.right = '20px';
    } else {
        modifierIconsContainer.style.top = '200px';
        modifierIconsContainer.style.right = '20px';
    }

    // Clear existing icons
    modifierIconsContainer.innerHTML = '';

    // Show container
    modifierIconsContainer.style.display = 'flex';

    // Lives icon
    if (livesEnabled && currentLives !== -1) {
        const livesIcon = createModifierIcon({
            iconClass: 'fas fa-heart',
            value: currentLives === 100 ? '100' : currentLives.toString(),
            title: `${currentLives} Lives`,
            size: iconSize
        });
        modifierIconsContainer.appendChild(livesIcon);
    }

    // Start question icon
    if (startQuestion > 0) {
        const startIcon = createModifierIcon({
            iconClass: 'fas fa-bullseye',
            value: (startQuestion + 1).toString(),
            title: `Start at Question ${startQuestion + 1}`,
            size: iconSize
        });
        modifierIconsContainer.appendChild(startIcon);
    }

    // Time multiplier icon
    if (timeMultiplier !== 1) {
        const timeIcon = createModifierIcon({
            iconClass: 'fas fa-stopwatch',
            value: `${timeMultiplier.toFixed(2)}x`,
            title: `Time Multiplier: ${timeMultiplier.toFixed(2)}x`,
            size: iconSize
        });
        modifierIconsContainer.appendChild(timeIcon);
    }

    // Fading mode icon
    if (fadingMode && fadingMode !== 'off') {
        const fadeIcon = createModifierIcon({
            iconClass: 'fas fa-eye',
            iconStyle: 'color: #a29bfe;',
            value: `${fadingMode}s`,
            title: `Vanish Mode: every ${fadingMode}s`,
            size: iconSize
        });
        modifierIconsContainer.appendChild(fadeIcon);
    }
}

/**
 * Create a modifier icon element.
 * @param {Object} options - Icon options.
 * @returns {HTMLElement} The icon element.
 */
function createModifierIcon({ iconClass, iconStyle = '', value, title, size }) {
    const icon = document.createElement('div');
    icon.className = 'modifier-icon';
    icon.title = title;
    icon.innerHTML = `
        <span style="font-size: 2.2em;"><i class="${iconClass}" style="${iconStyle}"></i></span>
        <br>
        <span style="font-size: 1.1em; font-weight: bold; margin-top: -5px;">${value}</span>
    `;
    icon.style.width = `${size}px`;
    icon.style.height = `${size}px`;
    icon.style.display = 'flex';
    icon.style.flexDirection = 'column';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    return icon;
}

/**
 * Hide the modifier icons container.
 */
export function hideModifierIcons() {
    const modifierIconsContainer = document.getElementById('modifierIcons');
    if (modifierIconsContainer) {
        modifierIconsContainer.style.display = 'none';
    }
}

/**
 * Show the modifier icons container.
 */
export function showModifierIcons() {
    const modifierIconsContainer = document.getElementById('modifierIcons');
    if (modifierIconsContainer) {
        modifierIconsContainer.style.display = 'flex';
    }
}

