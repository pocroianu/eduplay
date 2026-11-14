// You can write more code here

import Phaser from 'phaser';
import {
	GameConfig,
	DEFAULT_THEME,
	HydratedGameConfig,
	GameContext,
	GameContextProvider,
	GameManager,
	AudioManager,
	AccessibilityManager,
	ConfigLoader,
	ProgressIndicator,
	FeedbackOverlay,
	AnimatedBackground,
	i18n,
	getPreviewRuntimeSettings,
	GAME_FONT
} from '@edu-play/game-core';
import { SubjectPill } from '@edu-play/phaser-ui';
import ChoiceCard from '../prefabs/ChoiceCard';
import QuestionDisplay from '../prefabs/QuestionDisplay';

// Default game ID - can be overridden via URL params
const DEFAULT_GAME_ID = 'fruits-01';

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class Level extends Phaser.Scene {

	constructor() {
		super("Level");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// keyboard_key
		const keyboard_key = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

		// stage_placeholder
		const stage_placeholder = this.add.rectangle(640, 360, 1040, 500);
		stage_placeholder.isFilled = true;
		stage_placeholder.fillColor = 16777215;
		stage_placeholder.isStroked = true;
		stage_placeholder.lineWidth = 6;
		stage_placeholder.strokeColor = 8253167;

		// stage_title
		const stage_title = this.add.text(640, 220, "", {});
		stage_title.setOrigin(0.5, 0.5);
		stage_title.text = "Config-driven preview";
		stage_title.setStyle({ "align": "center", "color": "#2B5F94", "fontFamily": "Arial", "fontSize": "42px", "fontStyle": "bold" });

		// stage_hint
		const stage_hint = this.add.text(640, 500, "", {});
		stage_hint.setOrigin(0.5, 0.5);
		stage_hint.text = "Runtime content is built from the selected game config and asset registry.";
		stage_hint.setStyle({ "align": "center", "color": "#4C6A84", "fontFamily": "Arial", "fontSize": "24px" });
		stage_hint.setWordWrapWidth(720);

		this.keyboard_key = keyboard_key;

		this.events.emit("scene-awake");
	}

	private keyboard_key!: Phaser.Input.Keyboard.Key;

	/* START-USER-CODE */

	// Game components
	private gameManager!: GameManager;
	private audioManager!: AudioManager;
	private a11y!: AccessibilityManager;
	private configLoader!: ConfigLoader;
	private questionDisplay!: QuestionDisplay;
	private progressIndicator!: ProgressIndicator;
	private feedbackOverlay!: FeedbackOverlay;
	private animatedBackground!: AnimatedBackground;
	private duoTopicPill?: SubjectPill;
	private choiceCards: ChoiceCard[] = [];

	// State
	private isProcessingAnswer: boolean = false;
	public isLoading: boolean = true;  // Public for E2E test access
	private loadingText?: Phaser.GameObjects.Text;
	private loadingBg?: Phaser.GameObjects.Rectangle;

	create(data?: { config?: HydratedGameConfig }) {
		this.gameManager = GameManager.getInstance();
		this.audioManager = AudioManager.getInstance();
		this.audioManager.init(this);
		this.a11y = AccessibilityManager.getInstance();
		this.a11y.init(this);
		this.configLoader = ConfigLoader.getInstance();

		const { width, height } = this.cameras.main;

		// Check if config was passed from Preload scene
		if (data?.config) {
			// Use pre-loaded config
			this.applyConfig(data.config);
			this.isLoading = false;
			this.applyThemeOverride();
			this.initializeGame();
		} else {
			// Show loading state and load config (fallback)
			this.showLoadingState();

			// Load game config (async)
			this.loadGameConfig().then(() => {
				this.isLoading = false;
				this.hideLoadingState();
				this.applyThemeOverride();
				this.initializeGame();
			}).catch((error) => {
				console.error('Failed to load game config:', error);
				this.showErrorState(error.message);
			});
		}
	}

	/**
	 * Maps a HydratedGameConfig to the GameConfig format expected by GameManager.
	 */
	private mapHydratedConfig(hydrated: HydratedGameConfig): GameConfig {
		return {
			meta: {
				gameId: hydrated.meta.gameId,
				totalSteps: hydrated.meta.totalSteps,
				theme: hydrated.meta.theme,
				title: hydrated.meta.title,
				description: hydrated.meta.description,
				difficulty: hydrated.meta.difficulty,
				shuffleQuestions: hydrated.meta.shuffleQuestions,
				shuffleChoices: hydrated.meta.shuffleChoices
			},
			questions: hydrated.questions.map(q => ({
				id: q.id,
				question: {
					text: q.question.text,
					audio: q.question.audio,
					image: q.question.image
				},
				choices: q.choices.map(c => ({
					type: c.type,
					value: c.value,
					isCorrect: c.isCorrect,
					label: c.label
				})),
				timeLimit: q.timeLimit,
				points: q.points
			}))
		};
	}

	/**
	 * Apply a pre-loaded hydrated config to the game manager
	 */
	private applyConfig(hydratedConfig: HydratedGameConfig): void {
		this.gameManager.loadConfig(this.mapHydratedConfig(hydratedConfig));
	}

	private applyThemeOverride(): void {
		const override = getPreviewRuntimeSettings().theme;
		if (override) {
			this.gameManager.setThemeName(override);
		}
	}

	private showLoadingState(): void {
		const { width, height } = this.cameras.main;
		this.loadingBg = this.add.rectangle(width / 2, height / 2, width, height, 0x1F2937);
		this.loadingText = this.add.text(width / 2, height / 2, i18n.t('ui.loading'), {
			fontFamily: GAME_FONT,
			fontSize: '32px',
			color: '#FFFFFF'
		});
		this.loadingText.setOrigin(0.5);
	}

	private hideLoadingState(): void {
		if (this.loadingBg) {
			this.loadingBg.destroy();
			this.loadingBg = undefined;
		}
		if (this.loadingText) {
			this.loadingText.destroy();
			this.loadingText = undefined;
		}
	}

	private showErrorState(message: string): void {
		this.hideLoadingState();
		const { width, height } = this.cameras.main;
		const errorText = this.add.text(width / 2, height / 2, `Error: ${message}`, {
			fontFamily: GAME_FONT,
			fontSize: '24px',
			color: '#E87D7D',
			align: 'center',
			wordWrap: { width: width - 100 }
		});
		errorText.setOrigin(0.5);
	}

	private async loadGameConfig(): Promise<void> {
		// Check URL params for game ID and language
		const preview = getPreviewRuntimeSettings();
		const gameId = preview.gameId || ConfigLoader.getGameIdFromUrl() || DEFAULT_GAME_ID;
		const urlLang = preview.language || ConfigLoader.getLanguageFromUrl();
		if (urlLang) {
			i18n.setLanguage(urlLang);
		}

		// Load the game config
		const hydratedConfig = await this.configLoader.loadGame({
			gameId,
			language: i18n.getLanguage()
		});

		this.gameManager.loadConfig(this.mapHydratedConfig(hydratedConfig));
	}

	private initializeGame(): void {
		const theme = this.gameManager.getTheme();
		const { width, height } = this.cameras.main;

		// Create animated background
		this.animatedBackground = new AnimatedBackground(this, {
			width,
			height,
			theme
		});

		// Create UI components
		this.createUI();

		// Setup event listeners
		this.setupEventListeners();

		// Start the first question
		this.showQuestion();

		this.events.emit("scene-awake");
	}

	private createUI(): void {
		const theme = this.gameManager.getTheme();
		const { width, height } = this.cameras.main;

		// Progress indicator at top
		this.progressIndicator = new ProgressIndicator(this, {
			x: width / 2,
			y: 50,
			totalSteps: this.gameManager.getTotalQuestions(),
			theme,
			style: 'stars'
		});
		this.progressIndicator.animateIn();

		// Question display
		this.questionDisplay = new QuestionDisplay(this, {
			x: width / 2,
			y: 200,
			width: 900,
			height: 140,
			theme,
			mascotKey: 'FufuSuperDino'
		});
		this.questionDisplay.animateIn(200);

		// Feedback overlay (hidden initially)
		this.feedbackOverlay = new FeedbackOverlay(this, { theme });


		// Duo HUD chip — smoke-test for `@edu-play/phaser-ui` (EDU-135).
		// This proves the new tokens + primitive render in a real game scene;
		// it is intentionally minimal until the wider HUD migration tickets land.
		this.duoTopicPill = new SubjectPill(this, {
			x: width - 80,
			y: 32,
			label: 'DUO',
			tone: 'green',
		});
	}

	private setupEventListeners(): void {
		// Listen for game completion
		this.gameManager.on(GameManager.EVENTS.GAME_COMPLETE, this.onGameComplete, this);

		this.gameManager.setActivityCapabilities({ repeatInstruction: true });
		this.gameManager.on(GameManager.EVENTS.CONTROL_REPEAT_INSTRUCTION, this.onRepeatAudio, this);
		this.gameManager.on(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
		this.gameManager.on(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
		this.events.once('shutdown', this.shutdown, this);
	}

	private onRepeatAudio(): void {
		// Replay the current question audio
		this.questionDisplay.playAudio();
	}

	private onPauseGame(): void {
		this.choiceCards.forEach(card => card.disableInteractive());
		this.questionDisplay.stopAudio();
	}

	private onResumeGame(): void {
		this.choiceCards.forEach(card => {
			if (card.getState() === 'idle' || card.getState() === 'hover') {
				card.setInteractive({ useHandCursor: true });
			}
		});
	}

	private showQuestion(): void {
		const question = this.gameManager.getCurrentQuestion();
		if (!question) return;

		const theme = this.gameManager.getTheme();
		const { width, height } = this.cameras.main;

		// Update question display
		this.questionDisplay.setQuestion(question.question);

		// Clear existing choice cards
		this.clearChoiceCards();

		// Create choice cards
		const cardWidth = 200;
		const cardHeight = 200;
		const spacing = 80;
		const totalWidth = question.choices.length * cardWidth + (question.choices.length - 1) * spacing;
		const startX = (width - totalWidth) / 2 + cardWidth / 2;
		const cardY = height - 220;

		question.choices.forEach((choice, index) => {
			const card = new ChoiceCard(this, {
				x: startX + index * (cardWidth + spacing),
				y: cardY,
				width: cardWidth,
				height: cardHeight,
				choice,
				index,
				theme,
				audioManager: this.audioManager
			});

			// Staggered entrance animation
			card.animateIn(300 + index * 100);

			// Listen for selection
			card.on(ChoiceCard.EVENTS.SELECTED, this.onChoiceSelected, this);

			this.choiceCards.push(card);

			// Register with accessibility manager for keyboard navigation
			this.a11y.registerFocusable({
				id: `choice-${index}`,
				element: card,
				label: card.getAccessibleLabel(),
				group: 'choices',
				onSelect: () => card.selectViaKeyboard(),
				onFocus: () => card.showFocus(),
				onBlur: () => card.hideFocus()
			});
		});

		// Set choices as active group for keyboard navigation
		this.a11y.setActiveGroup('choices');

		// Auto-play question audio after cards appear.
		// Dual-trigger: Phaser timer is primary (correct 800 ms game-time delay at 60 fps);
		// setTimeout fallback fires at 1000 ms wall-clock so Docker headless rAF throttling
		// (~0.2 fps → ~20 s game-time per 800 ms) does not delay audio or the ARIA announcement.
		let audioAndAnnounceDone = false;
		const doAudioAndAnnounce = () => {
			if (audioAndAnnounceDone) return;
			audioAndAnnounceDone = true;
			this.questionDisplay.playAudio();
			this.a11y.announceQuestion(question.question.text, question.choices.length);
		};
		this.time.delayedCall(800, doAudioAndAnnounce);
		setTimeout(doAudioAndAnnounce, 1000);

		this.isProcessingAnswer = false;
	}

	private onChoiceSelected(data: { card: ChoiceCard; choice: any; index: number; isCorrect: boolean }): void {
		if (this.isProcessingAnswer) return;
		this.isProcessingAnswer = true;

		const { card, isCorrect, index } = data;

		// Disable all cards
		this.choiceCards.forEach(c => c.disable());

		// Submit answer to game manager
		this.gameManager.submitAnswer(index);

		// Disable keyboard navigation during feedback
		this.a11y.setKeyboardEnabled(false);

		// Show feedback on the selected card
		if (isCorrect) {
			card.showCorrect();
			this.questionDisplay.celebrateMascot();
			this.audioManager.playSfx('correct');
			this.a11y.announceResult(true);

			// Update progress
			this.progressIndicator.completeStep(this.gameManager.getCurrentQuestionIndex(), true);

			// Play star sound
			this.time.delayedCall(200, () => {
				this.audioManager.playSfx('star');
			});

			// Show celebration overlay
			this.feedbackOverlay.showCorrect().then(() => {
				this.proceedToNext();
			});
		} else {
			card.showIncorrect();
			this.questionDisplay.sadMascot();
			this.audioManager.playSfx('incorrect');

			// Show the correct answer
			const correctCard = this.choiceCards.find(c => c.isCorrect());
			const correctLabel = correctCard?.getAccessibleLabel();
			this.a11y.announceResult(false, correctLabel);

			if (correctCard) {
				this.time.delayedCall(500, () => {
					correctCard.showAsCorrectAnswer();
				});
			}

			// Update progress (wrong answer)
			this.progressIndicator.completeStep(this.gameManager.getCurrentQuestionIndex(), false);

			// Show encouragement overlay
			this.feedbackOverlay.showIncorrect().then(() => {
				this.proceedToNext();
			});
		}
	}

	private proceedToNext(): void {
		// Animate out current cards
		const animateOutPromises = this.choiceCards.map((card, index) =>
			card.animateOut(index * 50)
		);

		// Wait for animations then proceed
		Promise.all(animateOutPromises).then(() => {
			const hasNext = this.gameManager.nextQuestion();
			if (hasNext) {
				this.showQuestion();
			}
			// If no next question, game complete event will fire
		});
	}

	private clearChoiceCards(): void {
		// Clear accessibility registrations
		this.a11y.clearGroup('choices');

		this.choiceCards.forEach(card => {
			card.off(ChoiceCard.EVENTS.SELECTED, this.onChoiceSelected, this);
			card.destroy();
		});
		this.choiceCards = [];

		// Re-enable keyboard navigation for next question
		this.a11y.setKeyboardEnabled(true);
	}

	private onGameComplete(data: { score: number; totalQuestions: number; results: any[] }): void {
		console.log('Game Complete!', data);

		// Play completion sound
		this.audioManager.playSfx('complete');

		// Announce to screen reader
		this.a11y.announceGameComplete(data.score, data.totalQuestions);

		// Celebrate!
		this.progressIndicator.celebrateAll();

		// Transition to results scene after a short celebration delay.
		// Dual-trigger: Phaser's time.delayedCall (correct visual timing in real browsers)
		// + wall-clock setTimeout fallback for Docker headless where rAF is throttled.
		let transitioned = false;
		const startResults = () => {
			if (transitioned) return;
			transitioned = true;
			this.scene.start('Results', {
				score: data.score,
				totalQuestions: data.totalQuestions,
				results: data.results,
				starRating: this.gameManager.getStarRating()
			});
		};
		this.time.delayedCall(1500, startResults);
		setTimeout(startResults, 2000);
	}

	shutdown(): void {
		this.gameManager.off(GameManager.EVENTS.CONTROL_REPEAT_INSTRUCTION, this.onRepeatAudio, this);
		this.gameManager.off(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
		this.gameManager.off(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
		// Cleanup event listeners
		this.gameManager.off(GameManager.EVENTS.GAME_COMPLETE, this.onGameComplete, this);
		this.clearChoiceCards();

		// Cleanup accessibility
		this.a11y.cleanup();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
