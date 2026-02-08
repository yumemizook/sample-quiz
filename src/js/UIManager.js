/**
 * UI Manager Module
 * Handles updating the DOM (score display, timers, showing/hiding screens).
 */

import { getModeConfig, getModeFromUrl } from './GameConfig.js';

export class UIManager {
    constructor() {
        this.mode = getModeFromUrl();
        this.config = getModeConfig(this.mode);

        // Cache DOM elements
        this.questionEl = document.getElementById('ques');
        this.optionsEl = document.getElementById('opt');
        this.submitBtn = document.getElementById('btn');
        this.scoreDisplay = document.getElementById('score');
        this.timerDisplay = document.getElementById('timeelapsed');
        this.timerDiv = document.querySelector('.timerifinvalid');
        this.correctAnswerDiv = document.querySelector('.correctanswer');
        this.evalScreen = document.querySelector('.evalscreen');
        this.livesDisplay = document.getElementById('livesDisplay');
        this.livesCount = document.getElementById('livesCount');
        this.gradeDisplay = document.getElementById('currentgrade');
        this.pauseMenu = document.getElementById('pauseMenu');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.modifierIcons = document.getElementById('modifierIcons');

        this.answerOptions = []; // Radio inputs for current question
    }

    /**
     * Apply the mode-specific styling (background, colors).
     */
    applyModeStyles() {
        // Set background
        if (this.config.background) {
            document.body.style.backgroundImage = `url('${this.config.background}')`;
        } else {
            document.body.style.backgroundImage = 'none';
            document.body.style.backgroundColor = '#000000';
        }

        // Apply theme color to buttons and links
        const style = document.createElement('style');
        style.textContent = `
            .container button {
                background-color: ${this.config.themeColor};
                color: ${this.config.textColor};
            }
            a {
                color: ${this.config.themeColor};
            }
            #currentgrade {
                color: ${this.config.themeColor};
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Display loading message.
     * @param {number} progress - Loading progress percentage.
     */
    showLoading(progress) {
        if (this.questionEl) {
            this.questionEl.innerHTML = `<h5>Please Wait!! Loading Questions... (${progress}%)<br>DO NOT PANIC IF IT LOOKS STUCK</h5>`;
        }
        if (this.submitBtn) this.submitBtn.style.display = 'none';
    }

    /**
     * Display an error message.
     * @param {string} message - The error message.
     */
    showError(message) {
        if (this.questionEl) {
            this.questionEl.innerHTML = `<h5 style='color: red'>${message}</h5>`;
        }
        if (this.submitBtn) {
            this.submitBtn.style.display = 'block';
            this.submitBtn.innerHTML = 'Refresh';
            this.submitBtn.onclick = () => location.reload();
        }
    }

    /**
     * Render a question.
     * @param {object} question - The question object from the API.
     * @param {number} index - The question index (0-based).
     */
    renderQuestion(question, index) {
        if (!question || !this.questionEl || !this.optionsEl) return;

        // Decode HTML entities in question
        const decodedQuestion = this.decodeHtml(question.question);
        this.questionEl.innerHTML = `<h4>Question ${index + 1}</h4><p>${decodedQuestion}</p>`;

        // Build options
        const answers = [...question.incorrect_answers, question.correct_answer];
        this.shuffleArray(answers);

        let optionsHtml = '';
        this.answerOptions = [];

        answers.forEach((answer, i) => {
            const decodedAnswer = this.decodeHtml(answer);
            const id = `option-${i}`;
            optionsHtml += `
                <div class="option">
                    <input type="radio" name="answer" id="${id}" value="${answer}">
                    <label for="${id}">
                        <span class="keyboard-indicator">${i + 1}</span>
                        ${decodedAnswer}
                    </label>
                </div>
            `;
        });

        this.optionsEl.innerHTML = optionsHtml;
        this.answerOptions = Array.from(this.optionsEl.querySelectorAll('input[type="radio"]'));

        if (this.submitBtn) {
            this.submitBtn.style.display = 'block';
            this.submitBtn.innerHTML = 'SUBMIT';
        }
    }

    /**
     * Get the currently selected answer.
     * @returns {string|null} The selected answer value, or null if none selected.
     */
    getSelectedAnswer() {
        const selected = this.answerOptions.find(opt => opt.checked);
        return selected ? selected.value : null;
    }

    /**
     * Update the score display.
     * @param {number} score - Current score.
     * @param {number} totalGradePoints - Total grade points.
     */
    updateScore(score, totalGradePoints) {
        if (this.scoreDisplay) {
            this.scoreDisplay.innerHTML = `Score: ${score}`;
        }
        if (this.gradeDisplay) {
            this.gradeDisplay.innerHTML = `${totalGradePoints} pts`;
        }
    }

    /**
     * Update the lives display.
     * @param {number} lives - Current lives (-1 for unlimited).
     */
    updateLives(lives) {
        if (this.livesCount) {
            this.livesCount.textContent = lives === -1 ? '∞' : lives;
        }
        if (this.livesDisplay) {
            this.livesDisplay.style.display = lives === -1 ? 'none' : '';
        }
    }

    /**
     * Show the result of an answer (correct/incorrect).
     * @param {boolean} correct - Whether the answer was correct.
     * @param {string} correctAnswer - The correct answer text.
     */
    showAnswerResult(correct, correctAnswer) {
        if (!this.correctAnswerDiv) return;

        if (correct) {
            this.correctAnswerDiv.innerHTML = `<span style="color: ${this.config.themeColor}">Correct!</span>`;
        } else {
            const decoded = this.decodeHtml(correctAnswer);
            this.correctAnswerDiv.innerHTML = `<span style="color: #ff6b6b">Wrong! Correct: ${decoded}</span>`;
        }

        // Clear after 1.5 seconds
        setTimeout(() => {
            if (this.correctAnswerDiv) this.correctAnswerDiv.innerHTML = '';
        }, 1500);
    }

    /**
     * Show the evaluation/results screen.
     * @param {object} results - The results object from GameManager.
     */
    showEvalScreen(results) {
        if (!this.evalScreen) return;

        // Hide game elements
        if (this.questionEl) this.questionEl.style.display = 'none';
        if (this.optionsEl) this.optionsEl.style.display = 'none';
        if (this.submitBtn) this.submitBtn.style.display = 'none';

        // Format time
        const minutes = Math.floor(results.elapsedTime / 60000);
        const seconds = Math.floor((results.elapsedTime % 60000) / 1000);
        const timeStr = `${minutes}m ${seconds}s`;

        this.evalScreen.style.display = 'block';
        this.evalScreen.innerHTML = `
            <div class="eval-content">
                <h2>${results.modeName} Mode Complete!</h2>
                <div class="eval-stats">
                    <p>Score: ${results.score} / ${results.totalQuestions}</p>
                    <p>Grade Points: ${results.totalGradePoints}</p>
                    <p>Time: ${timeStr}</p>
                    ${results.livesRemaining !== -1 ? `<p>Lives Remaining: ${results.livesRemaining}</p>` : ''}
                </div>
                <button class="eval-btn" onclick="location.href='index.html'">Return to Menu</button>
            </div>
        `;
    }

    /**
     * Show/hide pause menu.
     * @param {boolean} show - Whether to show the menu.
     */
    togglePauseMenu(show) {
        if (this.pauseMenu) {
            this.pauseMenu.style.display = show ? 'flex' : 'none';
        }

        const container = document.querySelector('.container');
        if (container) {
            container.style.pointerEvents = show ? 'none' : 'auto';
            container.style.opacity = show ? '0.5' : '1';
        }
    }

    // --- Utility methods ---

    decodeHtml(html) {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

