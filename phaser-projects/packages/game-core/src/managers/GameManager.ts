import Phaser from 'phaser';
import {
	GameConfig,
	GameState,
	QuestionResult,
	Question,
	ThemeConfig,
	DEFAULT_THEME
} from '../types/GameConfig';
import { ThemeRegistry } from '../themes/ThemeRegistry';
import type { ActivityCapabilities, GameControlAction } from '../bridge/types';

// Lazy getter to avoid circular dependency with GameContextProvider
// The provider is accessed through a getter function that resolves at runtime
function getContextProvider(): any {
	// Dynamic import at runtime to break circular dependency
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	return (globalThis as any).__CONTEXT_PROVIDER__;
}

const CONTROL_EVENT_BY_ACTION: Record<GameControlAction, string> = {
	pause: 'control-pause',
	resume: 'control-resume',
	restart: 'control-restart',
	mute: 'control-mute',
	unmute: 'control-unmute',
	repeatInstruction: 'control-repeat-instruction',
};

export interface ActivityConfig {
	gameId?: string;
	title?: string;
	totalSteps: number;
	maxScore?: number;
	theme?: ThemeConfig;
	autoComplete?: boolean;
}

export interface SyntheticActivityConfig extends ActivityConfig {
	gameId: string;
	theme: ThemeConfig;
	meta?: Record<string, unknown>;
}

export interface ActivityResultsData {
	score: number;
	totalQuestions: number;
	results: QuestionResult[];
	starRating: number;
	restartScene?: string;
	rawScore: number;
	maxScore: number;
	scorePercent: number;
	totalSteps: number;
	completedSteps: number;
}

export interface CreateResultsDataOptions {
	restartScene?: string;
	totalQuestions?: number;
	starRating?: number;
}

export interface CompleteStepOptions {
	scoreDelta?: number;
	correct?: boolean;
}

export interface CompleteActivityOptions {
	starRating?: number;
}

interface ActivityState {
	isLoaded: boolean;
	gameId?: string;
	title?: string;
	theme?: ThemeConfig;
	totalSteps: number;
	maxScore: number;
	currentStepIndex: number;
	completedStepIndexes: Set<number>;
	autoComplete: boolean;
	starRatingOverride?: number;
}

export interface ActivityProgressPayload {
	gameId?: string;
	title?: string;
	stepIndex: number;
	currentStep: number;
	completedSteps: number;
	totalSteps: number;
	rawScore: number;
	maxScore: number;
	scorePercent: number;
	correct?: boolean;
}

export interface ActivityCompletePayload {
	gameId?: string;
	title?: string;
	score: number;
	rawScore: number;
	maxScore: number;
	scorePercent: number;
	totalSteps: number;
	completedSteps: number;
	totalQuestions: number;
	results: QuestionResult[];
	timeSpent: number;
	starRating: number;
}

/**
 * GameManager - Manager for game configuration and state
 * Handles config loading, game state, scoring, and events
 *
 * Supports both context-based usage (recommended) and legacy singleton pattern.
 */
export default class GameManager extends Phaser.Events.EventEmitter {
	/** Legacy singleton instance for backward compatibility */
	private static legacyInstance: GameManager | null = null;

	private config: GameConfig | null = null;
	private state: GameState;
	private activity: ActivityState;
	private activityCapabilities: ActivityCapabilities = {};

	// Event names for game flow
	static readonly EVENTS = {
		QUESTION_STARTED: 'question-started',
		QUESTION_ANSWERED: 'question-answered',
		CORRECT_ANSWER: 'correct-answer',
		INCORRECT_ANSWER: 'incorrect-answer',
		GAME_COMPLETE: 'game-complete',
		SCORE_UPDATED: 'score-updated',
		CONFIG_LOADED: 'config-loaded',
		ACTIVITY_LOADED: 'activity-loaded',
		STEP_STARTED: 'step-started',
		STEP_COMPLETED: 'step-completed',
		ACTIVITY_COMPLETE: 'activity-complete',
		ACTIVITY_CAPABILITIES_UPDATED: 'activity-capabilities-updated',
		CONTROL_PAUSE: 'control-pause',
		CONTROL_RESUME: 'control-resume',
		CONTROL_RESTART: 'control-restart',
		CONTROL_MUTE: 'control-mute',
		CONTROL_UNMUTE: 'control-unmute',
		CONTROL_REPEAT_INSTRUCTION: 'control-repeat-instruction'
	} as const;

	/**
	 * Create a new GameManager instance
	 * Prefer using GameContextProvider.createContext() for new code
	 */
	constructor() {
		super();
		this.state = this.createInitialState();
		this.activity = this.createInitialActivityState();
	}

	/**
	 * Get singleton instance
	 * @deprecated Use GameContextProvider.getActiveContext().gameManager instead
	 *
	 * Returns the active context's GameManager if available,
	 * otherwise falls back to legacy singleton for backward compatibility.
	 */
	static getInstance(): GameManager {
		// Try to get from active context first (via window global set by index.ts)
		const provider = getContextProvider();
		if (provider) {
			const context = provider.getActiveContext();
			if (context) {
				return context.gameManager;
			}
		}

		// Fallback to legacy singleton
		if (!GameManager.legacyInstance) {
			GameManager.legacyInstance = new GameManager();
		}
		return GameManager.legacyInstance;
	}

	// ============================================
	// Configuration
	// ============================================

	loadConfig(config: GameConfig): void {
		this.config = config;
		this.resetState();

		if (config.questions.length > 0) {
			this.loadActivity({
				gameId: config.meta.gameId,
				title: config.meta.title,
				totalSteps: config.questions.length,
				maxScore: config.questions.reduce((sum, question) => sum + (question.points ?? 1), 0),
				theme: config.meta.theme,
				autoComplete: false
			}, { resetState: false });
		}

		this.emit(GameManager.EVENTS.CONFIG_LOADED, config);
	}

	getConfig(): GameConfig | null {
		return this.config;
	}

	getTheme(): ThemeConfig {
		return this.config?.meta.theme ?? this.activity.theme ?? DEFAULT_THEME;
	}

	setThemeName(name: string): void {
		const registry = ThemeRegistry.getInstance();
		const def = registry.get(name);
		const theme = registry.toConfig(def);
		if (this.config) {
			this.config.meta.theme = theme;
		}
		if (this.activity.isLoaded) {
			this.activity.theme = theme;
		}
	}

	getTotalQuestions(): number {
		return this.config?.questions.length ?? 0;
	}

	setActivityCapabilities(capabilities: ActivityCapabilities): void {
		this.activityCapabilities = { ...capabilities };
		this.emit(GameManager.EVENTS.ACTIVITY_CAPABILITIES_UPDATED, this.getActivityCapabilities());
	}

	getActivityCapabilities(): ActivityCapabilities {
		return { ...this.activityCapabilities };
	}

	emitControl(action: GameControlAction): void {
		const event = CONTROL_EVENT_BY_ACTION[action];
		if (!event) return;

		this.emit(event, { action });
	}

	loadActivity(config: ActivityConfig, options: { resetState?: boolean } = {}): void {
		if (options.resetState !== false) {
			this.resetState();
		}

		const totalSteps = Math.max(0, Math.trunc(config.totalSteps));
		const maxScore = Math.max(0, config.maxScore ?? totalSteps);
		this.activity = {
			isLoaded: true,
			gameId: config.gameId,
			title: config.title,
			theme: config.theme,
			totalSteps,
			maxScore,
			currentStepIndex: -1,
			completedStepIndexes: new Set(),
			autoComplete: config.autoComplete ?? false
		};

		this.emit(GameManager.EVENTS.ACTIVITY_LOADED, this.createActivityLoadedPayload());
	}

	loadSyntheticActivityConfig(config: SyntheticActivityConfig): void {
		const totalSteps = Math.max(0, Math.trunc(config.totalSteps));
		const maxScore = Math.max(0, config.maxScore ?? totalSteps);
		const title = config.title ?? (typeof config.meta?.title === 'string' ? config.meta.title : undefined);
		this.loadConfig({
			meta: {
				...config.meta,
				gameId: config.gameId,
				totalSteps,
				theme: config.theme,
				title
			} as GameConfig['meta'],
			questions: []
		});
		this.loadActivity({
			gameId: config.gameId,
			title,
			totalSteps,
			maxScore,
			theme: config.theme,
			autoComplete: config.autoComplete
		}, { resetState: false });
	}

	// ============================================
	// Game State
	// ============================================

	private createInitialState(): GameState {
		return {
			currentQuestionIndex: 0,
			score: 0,
			results: [],
			startTime: Date.now(),
			isComplete: false
		};
	}

	private createInitialActivityState(): ActivityState {
		return {
			isLoaded: false,
			totalSteps: 0,
			maxScore: 0,
			currentStepIndex: -1,
			completedStepIndexes: new Set(),
			autoComplete: false
		};
	}

	resetState(): void {
		this.state = this.createInitialState();
		this.activity = this.createInitialActivityState();
	}

	getState(): GameState {
		return { ...this.state };
	}

	getCurrentQuestionIndex(): number {
		return this.state.currentQuestionIndex;
	}

	getCurrentQuestion(): Question | null {
		if (!this.config) return null;
		return this.config.questions[this.state.currentQuestionIndex] ?? null;
	}

	getScore(): number {
		return this.state.score;
	}

	deductPoints(amount: number): void {
		this.state.score = Math.max(0, this.state.score - amount);
		this.emit(GameManager.EVENTS.SCORE_UPDATED, this.state.score);
	}

	addPoints(amount: number): void {
		this.state.score += amount;
		this.emit(GameManager.EVENTS.SCORE_UPDATED, this.state.score);
	}

	isGameComplete(): boolean {
		return this.state.isComplete;
	}

	hasActivity(): boolean {
		return this.activity.isLoaded;
	}

	getTotalSteps(): number {
		return this.activity.totalSteps;
	}

	getCurrentStep(): number {
		return this.activity.currentStepIndex >= 0 ? this.activity.currentStepIndex + 1 : 0;
	}

	getCompletedSteps(): number {
		return this.activity.completedStepIndexes.size;
	}

	getMaxScore(): number {
		return this.activity.maxScore;
	}

	getScorePercent(): number {
		if (this.activity.maxScore <= 0) return 0;
		return Math.round((this.state.score / this.activity.maxScore) * 100);
	}

	// ============================================
	// Activity Flow
	// ============================================

	startStep(index: number): void {
		if (!this.activity.isLoaded || this.activity.totalSteps <= 0) return;

		const stepIndex = this.resolveStepIndex(index);
		if (stepIndex === null) return;

		this.activity.currentStepIndex = stepIndex;
		this.emit(GameManager.EVENTS.STEP_STARTED, this.createStepPayload(this.activity.currentStepIndex));
	}

	completeStep(index: number, options: CompleteStepOptions = {}): void {
		if (!this.activity.isLoaded || this.activity.totalSteps <= 0) return;

		const stepIndex = this.resolveStepIndex(index);
		if (stepIndex === null || this.activity.completedStepIndexes.has(stepIndex)) return;

		this.activity.currentStepIndex = stepIndex;
		this.activity.completedStepIndexes.add(stepIndex);

		const scoreDelta = options.scoreDelta ?? 0;
		if (scoreDelta !== 0) {
			this.state.score += scoreDelta;
			this.emit(GameManager.EVENTS.SCORE_UPDATED, this.state.score);
		}

		this.emit(GameManager.EVENTS.STEP_COMPLETED, this.createStepPayload(stepIndex, options.correct));

		if (this.activity.autoComplete && this.getCompletedSteps() >= this.getTotalSteps()) {
			this.completeActivity();
		}
	}

	completeActivity(options: CompleteActivityOptions = {}): void {
		if (this.state.isComplete) return;

		if (typeof options.starRating === 'number') {
			this.activity.starRatingOverride = options.starRating;
		}

		this.state.isComplete = true;
		const payload = this.createActivityCompletePayload();
		this.emit(GameManager.EVENTS.ACTIVITY_COMPLETE, payload);
		this.emit(GameManager.EVENTS.GAME_COMPLETE, payload);
	}

	// ============================================
	// Game Flow
	// ============================================

	startQuestion(): void {
		const question = this.getCurrentQuestion();
		if (question) {
			this.startStep(this.state.currentQuestionIndex);
			this.emit(GameManager.EVENTS.QUESTION_STARTED, {
				question,
				index: this.state.currentQuestionIndex,
				total: this.getTotalQuestions()
			});
		}
	}

	submitAnswer(choiceIndex: number): QuestionResult {
		const question = this.getCurrentQuestion();
		if (!question) {
			throw new Error('No current question to answer');
		}

		const choice = question.choices[choiceIndex];
		const isCorrect = choice?.isCorrect ?? false;
		const points = question.points ?? 1;

		const result: QuestionResult = {
			questionId: question.id,
			selectedChoiceIndex: choiceIndex,
			isCorrect,
			attempts: 1
		};

		this.state.results.push(result);
		this.completeStep(this.state.currentQuestionIndex, {
			scoreDelta: isCorrect ? points : 0,
			correct: isCorrect
		});

		if (isCorrect) {
			this.emit(GameManager.EVENTS.CORRECT_ANSWER, { result, question });
		} else {
			this.emit(GameManager.EVENTS.INCORRECT_ANSWER, { result, question });
		}

		this.emit(GameManager.EVENTS.QUESTION_ANSWERED, { result, question, isCorrect });

		return result;
	}

	nextQuestion(): boolean {
		if (!this.config) return false;

		const nextIndex = this.state.currentQuestionIndex + 1;

		if (nextIndex >= this.config.questions.length) {
			this.completeGame();
			return false;
		}

		this.state.currentQuestionIndex = nextIndex;
		this.startQuestion();
		return true;
	}

	completeGame(): void {
		if (this.activity.isLoaded) {
			this.completeActivity();
			return;
		}

		if (this.state.isComplete) return;

		this.state.isComplete = true;
		this.emit(GameManager.EVENTS.GAME_COMPLETE, {
			score: this.state.score,
			totalQuestions: this.getTotalQuestions(),
			totalSteps: this.config?.meta.totalSteps ?? this.getTotalQuestions(),
			results: this.state.results,
			timeSpent: Date.now() - this.state.startTime
		});
	}

	// ============================================
	// Results & Statistics
	// ============================================

	getResults(): QuestionResult[] {
		return [...this.state.results];
	}

	getCorrectCount(): number {
		return this.state.results.filter(r => r.isCorrect).length;
	}

	getAccuracy(): number {
		if (this.state.results.length === 0) return 0;
		return this.getCorrectCount() / this.state.results.length;
	}

	getStarRating(): number {
		if (typeof this.activity.starRatingOverride === 'number') {
			return this.activity.starRatingOverride;
		}

		const scorePercent = this.getScorePercent();
		if (scorePercent >= 90) return 3;
		if (scorePercent >= 70) return 2;
		if (scorePercent >= 50) return 1;
		return 0;
	}

	createResultsData(options: CreateResultsDataOptions = {}): ActivityResultsData {
		const starRating = options.starRating ?? this.getStarRating();
		return {
			score: this.state.score,
			totalQuestions: options.totalQuestions ?? this.activity.totalSteps,
			results: this.getResults(),
			starRating,
			...(options.restartScene ? { restartScene: options.restartScene } : {}),
			rawScore: this.state.score,
			maxScore: this.activity.maxScore,
			scorePercent: this.getScorePercent(),
			totalSteps: this.activity.totalSteps,
			completedSteps: this.getCompletedSteps()
		};
	}

	private resolveStepIndex(index: number): number | null {
		if (this.activity.totalSteps <= 0 || !Number.isFinite(index)) return null;

		const stepIndex = Math.trunc(index);
		if (stepIndex < 0 || stepIndex >= this.activity.totalSteps) return null;
		return stepIndex;
	}

	private createActivityLoadedPayload() {
		return {
			gameId: this.activity.gameId,
			title: this.activity.title,
			totalSteps: this.activity.totalSteps,
			maxScore: this.activity.maxScore,
			rawScore: this.state.score,
			scorePercent: this.getScorePercent(),
			completedSteps: this.getCompletedSteps(),
			currentStep: this.getCurrentStep()
		};
	}

	private createStepPayload(stepIndex: number, correct?: boolean): ActivityProgressPayload {
		return {
			gameId: this.activity.gameId,
			title: this.activity.title,
			stepIndex,
			currentStep: stepIndex >= 0 ? stepIndex + 1 : 0,
			completedSteps: this.getCompletedSteps(),
			totalSteps: this.activity.totalSteps,
			rawScore: this.state.score,
			maxScore: this.activity.maxScore,
			scorePercent: this.getScorePercent(),
			...(typeof correct === 'boolean' ? { correct } : {})
		};
	}

	private createActivityCompletePayload(): ActivityCompletePayload {
		return {
			gameId: this.activity.gameId,
			title: this.activity.title,
			score: this.state.score,
			rawScore: this.state.score,
			maxScore: this.activity.maxScore,
			scorePercent: this.getScorePercent(),
			totalSteps: this.activity.totalSteps,
			completedSteps: this.getCompletedSteps(),
			totalQuestions: this.getTotalQuestions(),
			results: this.getResults(),
			timeSpent: Date.now() - this.state.startTime,
			starRating: this.getStarRating()
		};
	}
}
