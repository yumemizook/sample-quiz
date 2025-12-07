# Icy's Quiz Challenge

A TGM-style quiz game featuring multiple difficulty modes, time limits, grade systems, and leaderboards.

## Features

- **4 Game Modes:**
  - 🌱 **Easy**: 30 questions, easy difficulty, no time pressure
  - ⭐ **Normal**: 100 questions, medium difficulty, timer after Q50
  - 👑 **Master**: 100 questions with shrinking timers and TGM-style grading
  - 🔥 **Hell**: 200 questions with extreme difficulty and time pressure

- **Scoring & Leaderboards:**
  - Global leaderboards for each mode
  - Personal statistics and history tracking
  - Input type tracking (keyboard/controller/mobile)
  - Filter scores by input method
  - Clear type tracking (failed, normal clear, hard, brave, absolute, catastrophe, all correct!)
  - Modifier tracking (lives, time multiplier, fading mode, start question)
  - Modifiers displayed under score in rankings and stats

- **Controls:**
  - Keyboard support (1-4 for answers, Space/Enter to submit)
  - Gamepad/Controller support
  - Mobile touch controls

- **Additional Features:**
  - Real-time grade calculation
  - Anti-stall mechanism (15-minute time limit)
  - Background music and sound effects
  - Progressive visual changes in Hell mode
  - Comprehensive wiki documentation
  - Mode settings menu (collapsed by default)
  - Game modifiers: Lives system, Time multiplier, Fading mode, Start question
  - Clear type system tracking completion conditions

## Getting Started

1. Open `index.html` in a web browser
2. Sign up or log in to save your scores
3. Select a game mode (the mode settings menu will appear, collapsed by default)
4. Optionally customize modifiers (lives, time multiplier, fading mode, start question)
5. Start playing!

## Technologies

- HTML5
- CSS3
- JavaScript (ES6+)
- Firebase (for authentication and score storage)
- OpenTDB API (for quiz questions)

## Game Modes

### Easy Mode
Perfect for beginners - 30 easy questions with no per-question timer.

### Normal Mode
Standard challenge - 100 medium difficulty questions with a 60-second timer per question after Q50.

### Master Mode
Expert level - 100 questions with rapidly shrinking timers and a comprehensive grade system (9-1, S1-S9, GM).

### Hell Mode
Ultimate challenge - 200 hard questions with extreme time pressure. Features progressive visual changes and special credits screen for Grand Master - Infinity grade.

## Documentation

See `wiki.html` for complete game documentation including:
- Detailed scoring systems
- Time limit tables
- Grade requirements
- Tips and strategies

## License

This project is for educational purposes.
