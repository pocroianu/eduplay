import Phaser from 'phaser';
import { ThemeConfig, DEFAULT_THEME } from '../types/GameConfig';
import { getActiveGameContext } from '../context';
import GameManager from '../managers/GameManager';
import i18n from '../i18n';
import { drawStar, drawRoundedRect } from '../utils/GraphicsUtils';
import { GAME_FONT } from '../utils/FontLoader';

export interface ResultsData {
	score?: number;
	totalQuestions?: number;
	results?: any[];
	starRating?: number;
	restartScene?: string;
	rawScore?: number;
	maxScore?: number;
	scorePercent?: number;
	totalSteps?: number;
	completedSteps?: number;
}

interface NormalizedResultsData extends ResultsData {
	starRating: number;
	rawScore: number;
	maxScore: number;
	scorePercent: number;
	totalSteps: number;
	completedSteps: number;
	scoreDisplayText: string;
}

function clampPercent(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

function calculateStarRating(scorePercent: number): number {
	if (scorePercent >= 90) return 3;
	if (scorePercent >= 70) return 2;
	if (scorePercent >= 50) return 1;
	return 0;
}

export function normalizeResultsData(data: ResultsData): NormalizedResultsData {
	const rawScore = data.rawScore ?? data.score ?? 0;
	const maxScore = Math.max(0, data.maxScore ?? data.totalQuestions ?? 0);
	const scorePercent = typeof data.scorePercent === 'number'
		? clampPercent(data.scorePercent)
		: maxScore > 0
			? clampPercent((rawScore / maxScore) * 100)
			: 0;
	const totalSteps = Math.max(0, data.totalSteps ?? data.totalQuestions ?? 0);
	const completedSteps = Math.max(0, Math.min(data.completedSteps ?? totalSteps, totalSteps));
	const starRating = data.starRating ?? calculateStarRating(scorePercent);

	return {
		...data,
		score: data.score ?? rawScore,
		totalQuestions: data.totalQuestions ?? totalSteps,
		results: data.results ?? [],
		starRating,
		rawScore,
		maxScore,
		scorePercent,
		totalSteps,
		completedSteps,
		scoreDisplayText: `${scorePercent}%`
	};
}

/**
 * Results Scene - End-of-game celebration with score display
 * Shows stars earned, score, and replay option
 */
export default class Results extends Phaser.Scene {
	private resultsData!: NormalizedResultsData;
	private theme!: ThemeConfig;
	private stars: Phaser.GameObjects.Graphics[] = [];

	constructor() {
		super('Results');
	}

	init(data: ResultsData): void {
		this.resultsData = normalizeResultsData(data);
		this.theme = GameManager.getInstance().getTheme();
	}

	create(): void {
		const { width, height } = this.cameras.main;

		// Background
		this.add.rectangle(width / 2, height / 2, width, height, this.theme.background);

		// Title — no emoji
		const title = this.add.text(width / 2, 80, i18n.t('results.title'), {
			fontFamily: GAME_FONT,
			fontSize: '56px',
			color: this.theme.textColor,
			stroke: '#000000',
			strokeThickness: 4
		});
		title.setOrigin(0.5);
		title.setAlpha(0);
		title.setScale(0);

		// Animate title in
		this.tweens.add({
			targets: title,
			alpha: 1,
			scaleX: 1,
			scaleY: 1,
			duration: 500,
			ease: 'Back.easeOut'
		});

		// Stars display
		this.createStarsDisplay(width / 2, 200);

		// Score display
		this.createScoreDisplay(width / 2, 350);

		// Message based on performance
		this.createMessage(width / 2, 450);

		// Play again button
		this.createPlayAgainButton(width / 2, 550);

		// Celebration effects
		this.time.delayedCall(500, () => {
			this.createCelebration();
		});
	}

	private createStarsDisplay(x: number, y: number): void {
		const starSpacing = 90;
		const starRadius = 36;
		const totalStars = 3;
		const startX = x - ((totalStars - 1) * starSpacing) / 2;

		for (let i = 0; i < totalStars; i++) {
			const starX = startX + i * starSpacing;

			// Empty star (background)
			const emptyGfx = this.add.graphics();
			drawStar(emptyGfx, 0, 0, starRadius, {
				fillColor: 0x4B5563,
				strokeColor: 0x374151,
				strokeWidth: 2
			});
			emptyGfx.setPosition(starX, y);

			// Filled star (earned) — starts invisible / scaled to 0
			const filledGfx = this.add.graphics();
			drawStar(filledGfx, 0, 0, starRadius, {
				fillColor: 0xFFD54F,
				strokeColor: 0xF9A825,
				strokeWidth: 2
			});
			filledGfx.setPosition(starX, y);
			filledGfx.setAlpha(0);
			filledGfx.setScale(0);

			this.stars.push(filledGfx);

			// Animate filled stars in sequence if earned
			if (i < this.resultsData.starRating) {
				this.time.delayedCall(800 + i * 300, () => {
					this.animateStarIn(filledGfx);
				});
			}
		}
	}

	private animateStarIn(star: Phaser.GameObjects.Graphics): void {
		// Pop in with overshoot
		this.tweens.add({
			targets: star,
			alpha: 1,
			scaleX: 1.3,
			scaleY: 1.3,
			duration: 250,
			ease: 'Back.easeOut',
			onComplete: () => {
				this.tweens.add({
					targets: star,
					scaleX: 1,
					scaleY: 1,
					duration: 150,
					ease: 'Bounce.easeOut'
				});
			}
		});

		// Create sparkles around star
		this.createSparkles(star.x, star.y);
	}

	private createSparkles(x: number, y: number): void {
		const colors = [0xFFD54F, 0xFFFFFF, 0xFDE68A];
		for (let i = 0; i < 8; i++) {
			const angle = (i / 8) * Math.PI * 2;
			const sparkle = this.add.circle(x, y, 4, colors[i % colors.length]);
			this.tweens.add({
				targets: sparkle,
				x: x + Math.cos(angle) * 60,
				y: y + Math.sin(angle) * 60,
				alpha: 0,
				duration: 600,
				ease: 'Power2',
				onComplete: () => sparkle.destroy()
			});
		}
	}

	private createScoreDisplay(x: number, y: number): void {
		// Score panel background — white rounded rect with themed border
		const panelGfx = this.add.graphics();
		panelGfx.fillStyle(0xFFFFFF, 0.95);
		panelGfx.fillRoundedRect(x - 150, y - 50, 300, 100, 20);
		panelGfx.lineStyle(4, this.theme.primary, 1);
		panelGfx.strokeRoundedRect(x - 150, y - 50, 300, 100, 20);
		panelGfx.setAlpha(0);

		// Score text — dark color for contrast on white panel. Prefer a
		// percentage so points and learner-facing steps are never mixed.
		const scoreText = this.add.text(x, y, this.resultsData.scoreDisplayText, {
			fontFamily: GAME_FONT,
			fontSize: '48px',
			fontStyle: 'bold',
			color: '#1A237E'
		});
		scoreText.setOrigin(0.5);
		scoreText.setAlpha(0);

		// Label — use white for visibility on themed backgrounds
		const label = this.add.text(x, y - 60, i18n.t('results.score'), {
			fontFamily: GAME_FONT,
			fontSize: '24px',
			fontStyle: 'bold',
			color: this.theme.textColor
		});
		label.setOrigin(0.5);
		label.setAlpha(0);

		// Animate in
		this.tweens.add({
			targets: [panelGfx, scoreText, label],
			alpha: 1,
			duration: 400,
			delay: 600,
			ease: 'Power2'
		});
	}

	private createMessage(x: number, y: number): void {
		let message: string;

		const accuracy = this.resultsData.scorePercent / 100;

		if (accuracy >= 0.9) {
			message = i18n.t('results.perfect');
		} else if (accuracy >= 0.7) {
			message = i18n.t('results.excellent');
		} else if (accuracy >= 0.5) {
			message = i18n.t('results.good');
		} else {
			message = i18n.t('results.tryAgain');
		}

		const messageText = this.add.text(x, y, message, {
			fontFamily: GAME_FONT,
			fontSize: '28px',
			color: this.theme.textColor,
			align: 'center'
		});
		messageText.setOrigin(0.5);
		messageText.setAlpha(0);

		this.tweens.add({
			targets: messageText,
			alpha: 1,
			y: y - 10,
			duration: 400,
			delay: 1200,
			ease: 'Back.easeOut'
		});
	}

	private createPlayAgainButton(x: number, y: number): void {
		const button = this.add.container(x, y);

		// Bottom shadow (drawn first — behind)
		const shadowGfx = this.add.graphics();
		shadowGfx.fillStyle(0xF9A825, 1);
		shadowGfx.fillRoundedRect(-130, -35 + 4, 260, 70, 35);

		// Gold pill background
		const pillGfx = this.add.graphics();
		pillGfx.fillStyle(0xFFD54F, 1);
		pillGfx.fillRoundedRect(-130, -35, 260, 70, 35);

		// Button label — dark purple, no emoji
		const text = this.add.text(0, 0, i18n.t('ui.restart'), {
			fontFamily: GAME_FONT,
			fontSize: '28px',
			fontStyle: 'bold',
			color: '#4A148C'
		});
		text.setOrigin(0.5);

		button.add([shadowGfx, pillGfx, text]);
		button.setSize(260, 74);
		button.setInteractive({ useHandCursor: true });
		button.setAlpha(0);
		button.setScale(0);

		// Animate in
		this.tweens.add({
			targets: button,
			alpha: 1,
			scaleX: 1,
			scaleY: 1,
			duration: 400,
			delay: 1500,
			ease: 'Back.easeOut'
		});

		// Hover: scale up
		button.on('pointerover', () => {
			this.tweens.add({
				targets: button,
				scaleX: 1.08,
				scaleY: 1.08,
				duration: 150,
				ease: 'Back.easeOut'
			});
		});

		// Hover out: reset scale
		button.on('pointerout', () => {
			this.tweens.add({
				targets: button,
				scaleX: 1,
				scaleY: 1,
				duration: 150
			});
		});

		// Press: compress
		button.on('pointerdown', () => {
			this.tweens.add({
				targets: button,
				scaleX: 0.95,
				scaleY: 0.95,
				duration: 50
			});
		});

		// Release: restart game
		button.on('pointerup', () => {
			GameManager.getInstance().resetState();
			this.scene.start(this.resultsData.restartScene ?? 'Level');
		});
	}

	private createCelebration(): void {
		// Only celebrate for good scores
		if (this.resultsData.starRating < 2) return;

		const { width, height } = this.cameras.main;

		// Confetti
		const colors = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0x95E1D3, 0xF38181, 0xAA96DA];

		for (let i = 0; i < 30; i++) {
			const cx = Phaser.Math.Between(0, width);
			const confetti = this.add.rectangle(
				cx,
				-20,
				Phaser.Math.Between(8, 12),
				Phaser.Math.Between(8, 12),
				colors[Math.floor(Math.random() * colors.length)]
			);
			confetti.setAngle(Phaser.Math.Between(0, 360));

			this.tweens.add({
				targets: confetti,
				y: height + 50,
				x: cx + Phaser.Math.Between(-80, 80),
				angle: Phaser.Math.Between(360, 720),
				duration: Phaser.Math.Between(2000, 3500),
				delay: Phaser.Math.Between(0, 1000),
				ease: 'Sine.easeIn',
				onComplete: () => confetti.destroy()
			});
		}
	}
}
