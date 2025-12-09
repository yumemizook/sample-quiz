# Achievements System Documentation

## Overview

The achievements system in `achievements.html` provides an extensible, easy-to-use framework for tracking and displaying player achievements. Achievements are organized into categories and can check various conditions across all game modes.

## Architecture

### Achievement Categories

Achievements are organized into three main categories:

1. **Mode Completion Achievements** (`COMPLETION_ACHIEVEMENTS`)
   - Achievements for completing game modes with specific scores or grades
   - Examples: Perfect scores, GM grades, high scores

2. **Level Badge Achievements** (`LEVEL_BADGES`)
   - Automatically generated from level thresholds
   - Each badge represents a player level milestone

3. **Special Achievements** (`SPECIAL_ACHIEVEMENTS`)
   - Various achievements including:
     - First game completion
     - Mode exploration
     - Level milestones
     - Modifier-based achievements (lives, time multiplier, vanish timer)
     - Modifier combination achievements

### Achievement Data Structure

Each achievement is defined as an object with the following properties:

```javascript
{
  id: 'unique_achievement_id',           // Unique identifier (required)
  icon: '🎮',                             // Emoji or icon (required)
  title: 'Achievement Name',             // Display title (required)
  description: 'What the player needs to do', // Description (required)
  unlockedMessage: 'Custom unlock message',   // Optional: Custom message when unlocked
  checkUnlocked: (data) => {             // Function that returns true if unlocked (required)
    // Check logic here
    return condition;
  }
}
```

### Data Object Structure

The `checkUnlocked` function receives a `data` object containing:

```javascript
{
  easyScores: [...],      // Array of easy mode scores
  normalScores: [...],    // Array of normal mode scores
  masterScores: [...],    // Array of master mode scores
  raceScores: [...],      // Array of race mode scores
  hellScores: [...],      // Array of hell mode scores
  playerData: {           // Player level and XP data
    level: number,
    experience: number,
    xpForCurrentLevel: number,
    xpForNextLevel: number,
    xpInCurrentLevel: number,
    xpNeededForNextLevel: number
  },
  currentLevel: number,    // Current player level
  isLoggedIn: boolean     // Whether user is logged in
}
```

## Helper Functions

### Score Checking Functions

#### `hasClearType(score, clearType)`
Checks if a score has a specific clear type.

**Parameters:**
- `score`: Score object from Firestore
- `clearType`: String - "Absolute", "Catastrophy", "All Correct!", etc.

**Returns:** `boolean`

**Example:**
```javascript
checkUnlocked: (data) => data.easyScores?.some(s => hasClearType(s, "Absolute")) || false
```

#### `has2xTimeMultiplier(score)`
Checks if a score was achieved with 2x time multiplier.

**Parameters:**
- `score`: Score object from Firestore

**Returns:** `boolean`

**Example:**
```javascript
checkUnlocked: (data) => data.masterScores?.some(has2xTimeMultiplier) || false
```

#### `has05sVanishTimer(score)`
Checks if a score was achieved with 0.5s vanish timer.

**Parameters:**
- `score`: Score object from Firestore

**Returns:** `boolean`

**Example:**
```javascript
checkUnlocked: (data) => data.hellScores?.some(has05sVanishTimer) || false
```

### Combination Checking Function

#### `hasModifierCombination(data, checkFunction)`
Checks for modifier combinations across all game modes.

**Parameters:**
- `data`: The achievement data object
- `checkFunction`: A function that takes a score and returns boolean

**Returns:** `boolean`

**Example:**
```javascript
checkUnlocked: (data) => hasModifierCombination(data, (score) => 
  has05sVanishTimer(score) && has2xTimeMultiplier(score) && hasClearType(score, "Absolute")
)
```

## Score Object Structure

Scores from Firestore have the following structure:

```javascript
{
  name: string,                    // Player name
  score: number,                   // Score value (mode-dependent)
  gradePoints: number,             // Grade points (race mode)
  grade: string,                   // Grade (e.g., "GM", "S9", "AAA")
  time: string,                    // Completion time (e.g., "12:34:56")
  date: string,                    // Submission date
  line: string,                    // Line color (e.g., "orange", "green")
  inputType: string,               // Input method ("keyboard", "controller", "mobile", "mouse")
  pauseCount: number,              // Number of pauses
  totalPausedTime: string,          // Total paused time
  clearType: string,               // Clear type ("Absolute", "Catastrophy", "All Correct!", etc.)
  modifiers: {                     // Modifier settings
    lives: number,                 // Starting lives (10, 5, 1, etc.)
    timeMultiplier: number,        // Time multiplier (0.75-2.0)
    fadingMode: string,            // Vanish timer ("0.5", "1", "2", "off")
    startQuestion: number          // Starting question number
  }
}
```

## How to Add New Achievements

### Step 1: Choose the Appropriate Category

Decide which category your achievement belongs to:
- **Mode Completion**: For mode-specific completion achievements
- **Level Badges**: Automatically handled (don't add manually)
- **Special Achievements**: For general achievements
- **Combination Achievements**: For modifier combinations (add to `COMBINATION_ACHIEVEMENTS`)

### Step 2: Define the Achievement Object

Add your achievement to the appropriate array:

```javascript
{
  id: 'my_achievement_id',
  icon: '🏆',
  title: 'My Achievement',
  description: 'Complete this specific challenge',
  unlockedMessage: '🎉 You did it! Amazing work!', // Optional
  checkUnlocked: (data) => {
    // Your check logic here
    // Access data.easyScores, data.masterScores, etc.
    return condition;
  }
}
```

### Step 3: Write the Check Function

The `checkUnlocked` function should:
- Return `false` if user is not logged in (unless achievement doesn't require login)
- Check the appropriate score arrays
- Use helper functions when possible
- Return `boolean`

**Examples:**

**Simple mode completion:**
```javascript
checkUnlocked: (data) => data.easyScores?.some(s => s.score === 30) || false
```

**Grade-based:**
```javascript
checkUnlocked: (data) => data.masterScores?.some(s => s.grade === "GM") || false
```

**Modifier-based:**
```javascript
checkUnlocked: (data) => data.hellScores?.some(has2xTimeMultiplier) || false
```

**Cross-mode combination:**
```javascript
checkUnlocked: (data) => hasModifierCombination(data, (score) => 
  has05sVanishTimer(score) && hasClearType(score, "Absolute")
)
```

**Level-based:**
```javascript
checkUnlocked: (data) => (data.playerData?.level || 0) >= 50
```

**Multiple conditions:**
```javascript
checkUnlocked: (data) => {
  const totalGames = (data.easyScores?.length || 0) + 
                     (data.normalScores?.length || 0) + 
                     (data.masterScores?.length || 0);
  return totalGames >= 100;
}
```

## Common Patterns

### Checking a Single Mode

```javascript
checkUnlocked: (data) => data.masterScores?.some(s => condition) || false
```

### Checking All Modes

```javascript
checkUnlocked: (data) => {
  const allScores = [
    ...(data.easyScores || []),
    ...(data.normalScores || []),
    ...(data.masterScores || []),
    ...(data.hellScores || []),
    ...(data.raceScores || [])
  ];
  return allScores.some(s => condition);
}
```

### Using Helper Functions

```javascript
// Single modifier
checkUnlocked: (data) => data.easyScores?.some(has2xTimeMultiplier) || false

// Multiple modifiers
checkUnlocked: (data) => hasModifierCombination(data, (score) => 
  has05sVanishTimer(score) && has2xTimeMultiplier(score)
)
```

### Checking Clear Types

```javascript
// Specific clear type
checkUnlocked: (data) => data.masterScores?.some(s => hasClearType(s, "Absolute")) || false

// Multiple clear types
checkUnlocked: (data) => {
  const lowLivesClears = ["Absolute", "Catastrophy", "All Correct!"];
  return data.easyScores?.some(s => 
    s.clearType && lowLivesClears.includes(s.clearType)
  ) || false;
}
```

## Clear Types Reference

Clear types are determined by starting lives and completion status:

- **"Absolute"**: 10 starting lives
- **"Catastrophy"**: 5 starting lives
- **"All Correct!"**: 1 starting life with no wrong answers
- **"Hard"**: 100 starting lives
- **"Brave"**: 30 starting lives
- **"Clear"**: Default clear (no special modifier)
- **"Failed"**: Quiz not completed or ran out of lives/time

## Modifier Values Reference

### Lives (`modifiers.lives`)
- `-1` or `undefined`: Unlimited lives
- `100`: 100 lives
- `30`: 30 lives
- `10`: 10 lives
- `5`: 5 lives
- `1`: 1 life

### Time Multiplier (`modifiers.timeMultiplier`)
- Range: `0.75` to `2.0`
- `1.0`: Normal speed
- `2.0`: 2x speed (faster countdown)
- `0.75`: Slower countdown

### Vanish Timer (`modifiers.fadingMode`)
- `"off"` or `undefined`: Disabled
- `"2"`: 2 seconds
- `"1"`: 1 second
- `"0.5"`: 0.5 seconds

## Rendering System

Achievements are automatically rendered using the `renderAchievementCard()` function:

```javascript
function renderAchievementCard(achievement, unlocked, progressText = null)
```

**Parameters:**
- `achievement`: Achievement object
- `unlocked`: Boolean indicating if achievement is unlocked
- `progressText`: Optional custom progress text (used for level badges)

The function:
- Applies unlocked/locked styling
- Displays icon, title, description
- Shows custom unlock message if provided
- Handles progress text for level badges

## Best Practices

1. **Use descriptive IDs**: Make achievement IDs clear and unique (e.g., `'master_gm_grade'` not `'ach1'`)

2. **Provide clear descriptions**: Help players understand what they need to do

3. **Add unlock messages**: Make achievements feel rewarding with custom messages

4. **Use helper functions**: Reuse existing helper functions when possible

5. **Check for null/undefined**: Always use optional chaining (`?.`) when accessing score arrays

6. **Return boolean**: Always return `true` or `false`, never `undefined`

7. **Consider all modes**: For cross-mode achievements, use `hasModifierCombination()` or check all score arrays

8. **Test edge cases**: Ensure achievements work for logged-out users (should show as locked)

## Example: Adding a New Achievement

Let's add an achievement for completing 50 games total across all modes:

```javascript
// Add to SPECIAL_ACHIEVEMENTS array
{
  id: '50_games',
  icon: '🎯',
  title: 'Dedicated Player',
  description: 'Complete 50 games across all modes',
  unlockedMessage: '🎯 50 games completed! You\'re truly dedicated!',
  checkUnlocked: (data) => {
    const totalGames = (data.easyScores?.length || 0) + 
                       (data.normalScores?.length || 0) + 
                       (data.masterScores?.length || 0) + 
                       (data.raceScores?.length || 0) + 
                       (data.hellScores?.length || 0);
    return totalGames >= 50;
  }
}
```

## File Structure

The achievements system is located in `achievements.html`:

- **Configuration Section** (lines ~404-883): All achievement definitions
- **Helper Functions** (lines ~486-502): Utility functions for checking conditions
- **Rendering Functions** (lines ~889-910): Functions to display achievements
- **Display Function** (lines ~912-970): Main function that renders all achievements
- **Data Loading** (lines ~340-397): Fetches scores from Firestore

## Integration with Firestore

The system fetches scores from the following Firestore collections:
- `scoreseasy`: Easy mode scores
- `scoresnormal`: Normal mode scores
- `scoresmaster`: Master mode scores
- `scoresrace`: Race mode scores
- `scoresfinal`: Hell mode scores

Scores are filtered by matching player names (including previous usernames) from the `userProfiles` collection.

## Troubleshooting

### Achievement not unlocking
1. Check that the `checkUnlocked` function returns `true` for the condition
2. Verify the score data structure matches expectations
3. Ensure the player is logged in (`isLoggedIn` must be `true`)
4. Check browser console for errors

### Achievement showing as locked when it should be unlocked
1. Verify the score exists in Firestore with correct modifiers/clearType
2. Check that player name matching is working (includes previous usernames)
3. Ensure the condition logic is correct

### Performance issues
- The system loads all scores from all collections, which may be slow for large datasets
- Consider adding pagination or caching if needed

## Future Enhancements

Potential improvements to the system:
- Achievement progress tracking (e.g., "5/10 games completed")
- Achievement categories with filtering
- Achievement search functionality
- Achievement statistics (percentage of players who unlocked)
- Achievement notifications when unlocked

