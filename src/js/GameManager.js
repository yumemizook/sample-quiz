/**
 * Game Manager Module
 * Core class handling the game loop (fetching questions, processing answers, scoring).
 */

import { getModeConfig, getModeFromUrl } from './GameConfig.js';

export class GameManager {
    constructor() {
        this.mode = getModeFromUrl();
        this.config = getModeConfig(this.mode);
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.totalGradePoints = 0;
        this.currentLives = -1; // -1 for unlimited
        this.isPaused = false;
        this.quizStartTime = null;
        this.questionStartTime = null;
        this.totalPausedTime = 0;
        this.pauseCount = 0;
        this.quizAbandoned = false;
        this.totalWrongAnswers = 0;

        // Read URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const livesParam = urlParams.get('lives') || 'unlimited';
        this.initialLives = livesParam === 'unlimited' ? -1 : parseInt(livesParam);
        this.currentLives = this.initialLives;
        this.timeMultiplier = parseFloat(urlParams.get('timeMultiplier') || '1');
        this.fadingMode = urlParams.get('fading') || 'off';
        this.startQuestion = parseInt(urlParams.get('start') || '0');

        this.onQuestionLoaded = null; // Callback
        this.onScoreUpdated = null;   // Callback
        this.onGameOver = null;       // Callback
        this.onLivesUpdated = null;   // Callback
    }

    get livesEnabled() {
        return this.initialLives !== -1;
    }

    /**
     * Helper function to get audio volume from settings (0-1 range).
     */
    getAudioVolume() {
        const savedVolume = localStorage.getItem('audioVolume');
        const volume = savedVolume !== null ? parseInt(savedVolume) : 100;
        return volume / 100;
    }

    /**
     * Fetch questions from the API based on the mode configuration.
     */
    async fetchQuestions(onProgress) {
        const totalQuestions = this.config.questionCount;
        const questionsPerRequest = 50;
        const numRequests = Math.ceil(totalQuestions / questionsPerRequest);
        const maxRetries = 3;

        this.questions = [];
        let failedRequests = 0;

        for (let i = 0; i < numRequests; i++) {
            const progress = Math.floor(((i + 1) / numRequests) * 100);
            if (onProgress) onProgress(progress);

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
                        `https://opentdb.com/api.php?amount=${amount}&difficulty=${this.config.difficulty}`
                    );

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();

                    if (data.response_code && data.response_code !== 0) {
                        throw new Error(`API Error Code: ${data.response_code}`);
                    }

                    if (data.results && data.results.length > 0) {
                        this.questions.push(...data.results);
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

        if (this.questions.length === 0) {
            throw new Error('Failed to fetch any questions. Please try again.');
        }

        console.log(`Successfully loaded ${this.questions.length} questions.`);
        return this.questions;
    }

    /**
     * Get the current question.
     */
    getCurrentQuestion() {
        if (this.currentQuestionIndex >= this.questions.length) {
            return null;
        }
        return this.questions[this.currentQuestionIndex];
    }

    /**
     * Process the user's answer.
     * @param {string} selectedAnswer - The answer selected by the user.
     * @returns {object} Result object { correct, correctAnswer, gradePoints }.
     */
    processAnswer(selectedAnswer) {
        const question = this.getCurrentQuestion();
        if (!question) return { correct: false, correctAnswer: null, gradePoints: 0 };

        const correctAnswer = question.correct_answer;
        const correct = selectedAnswer === correctAnswer;

        let gradePoints = 0;

        if (correct) {
            this.score++;
            // Calculate grade points based on time taken (placeholder logic)
            const timeElapsed = Date.now() - this.questionStartTime;
            if (timeElapsed < 5000) gradePoints = 100;
            else if (timeElapsed < 10000) gradePoints = 80;
            else if (timeElapsed < 20000) gradePoints = 50;
            else gradePoints = 20;

            this.totalGradePoints += gradePoints;
        } else {
            this.totalWrongAnswers++;
            if (this.livesEnabled && this.currentLives > 0) {
                this.currentLives--;
                if (this.onLivesUpdated) this.onLivesUpdated(this.currentLives);
            }
        }

        if (this.onScoreUpdated) {
            this.onScoreUpdated(this.score, this.totalGradePoints);
        }

        return { correct, correctAnswer, gradePoints };
    }

    /**
     * Move to the next question.
     * @returns {boolean} True if there's a next question, false if game is over.
     */
    nextQuestion() {
        this.currentQuestionIndex++;

        // Check for game over conditions
        if (this.livesEnabled && this.currentLives <= 0) {
            if (this.onGameOver) this.onGameOver('lives');
            return false;
        }

        if (this.currentQuestionIndex >= this.questions.length) {
            if (this.onGameOver) this.onGameOver('complete');
            return false;
        }

        this.questionStartTime = Date.now();
        if (this.onQuestionLoaded) {
            this.onQuestionLoaded(this.getCurrentQuestion(), this.currentQuestionIndex);
        }
        return true;
    }

    /**
     * Start the quiz.
     */
    startQuiz() {
        this.currentQuestionIndex = this.startQuestion;
        this.quizStartTime = Date.now();
        this.questionStartTime = Date.now();

        if (this.onQuestionLoaded && this.questions.length > 0) {
            this.onQuestionLoaded(this.getCurrentQuestion(), this.currentQuestionIndex);
        }
    }

    /**
     * Get quiz results for the eval screen.
     */
    getResults() {
        const elapsedTime = Date.now() - this.quizStartTime - this.totalPausedTime;
        return {
            mode: this.mode,
            modeName: this.config.name,
            score: this.score,
            totalQuestions: this.questions.length,
            totalGradePoints: this.totalGradePoints,
            elapsedTime,
            totalWrongAnswers: this.totalWrongAnswers,
            livesRemaining: this.currentLives,
            initialLives: this.initialLives,
            abandoned: this.quizAbandoned,
            pauseCount: this.pauseCount,
            totalPausedTime: this.totalPausedTime
        };
    }
}

