import Phaser from 'phaser';
import { ThemeConfig, DEFAULT_THEME, FeedbackType } from '../types/GameConfig';
import i18n from '../i18n';
import { drawStar } from '../utils/GraphicsUtils';
import { GAME_FONT } from '../utils/FontLoader';

export interface FeedbackOverlayConfig {
	theme?: ThemeConfig;
}

/**
 * FeedbackOverlay - Full-screen feedback for correct/incorrect answers
 * Features celebratory particles, stars, and encouraging messages for kids
 */
export default class FeedbackOverlay extends Phaser.GameObjects.Container {
	private theme: ThemeConfig;
	private overlay!: Phaser.GameObjects.Rectangle;
	private messageText!: Phaser.GameObjects.Text;
	private pointsText!: Phaser.GameObjects.Text;
	private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

	private screenWidth: number;
	private screenHeight: number;

	static readonly EVENTS = {
		FEEDBACK_COMPLETE: 'feedback-complete'
	} as const;

	constructor(scene: Phaser.Scene, config?: FeedbackOverlayConfig) {
		super(scene, 0, 0);

		this.theme = config?.theme ?? DEFAULT_THEME;
		this.screenWidth = scene.cameras.main.width;
		this.screenHeight = scene.cameras.main.height;

		this.createOverlay();

		// Start hidden
		this.setVisible(false);
		this.setDepth(1000); // Always on top

		scene.add.existing(this);
	}

	private createOverlay(): void {
		// Semi-transparent background
		this.overlay = this.scene.add.rectangle(
			this.screenWidth / 2,
			this.screenHeight / 2,
			this.screenWidth,
			this.screenHeight,
			0x000000,
			0.5
		);
		this.overlay.setAlpha(0);
		this.add(this.overlay);

		// Message text
		this.messageText = this.scene.add.text(
			this.screenWidth / 2,
			this.screenHeight / 2 - 30,
			'',
			{
				fontFamily: GAME_FONT,
				fontSize: '64px',
				fontStyle: 'bold',
				color: '#FFFFFF',
				stroke: '#000000',
				strokeThickness: 6,
				align: 'center'
			}
		);
		this.messageText.setOrigin(0.5);
		this.messageText.setAlpha(0);
		this.add(this.messageText);

		// Points text (secondary label below message)
		this.pointsText = this.scene.add.text(
			this.screenWidth / 2,
			this.screenHeight / 2 + 60,
			'',
			{
				fontFamily: GAME_FONT,
				fontSize: '28px',
				color: '#FFFFFF',
				align: 'center'
			}
		);
		this.pointsText.setOrigin(0.5);
		this.pointsText.setAlpha(0);
		this.add(this.pointsText);
	}

	// ============================================
	// Public Methods
	// ============================================

	showCorrect(duration: number = 1500): Promise<void> {
		return this.showFeedback('correct', duration);
	}

	showIncorrect(duration: number = 1200): Promise<void> {
		return this.showFeedback('incorrect', duration);
	}

	showFeedback(type: FeedbackType, duration: number = 1500): Promise<void> {
		return new Promise((resolve) => {
			this.setVisible(true);

			const isCorrect = type === 'correct';
			const message = isCorrect
				? i18n.tRandom('feedback.correct')
				: i18n.tRandom('feedback.incorrect');

			// Green for correct, warm orange for incorrect (encouraging, not punishing)
			const bgColor = isCorrect ? 0x4CAF50 : 0xFF9800;
			const bgAlpha = isCorrect ? 0.95 : 0.92;

			// Set content
			this.messageText.setText(message);
			this.pointsText.setText(isCorrect ? '+10' : '');

			// Animate overlay in
			this.overlay.setFillStyle(bgColor);
			this.scene.tweens.add({
				targets: this.overlay,
				alpha: bgAlpha,
				duration: 200
			});

			// Animate message text: scale from 0 with Back.easeOut
			this.messageText.setScale(0);
			this.messageText.setAlpha(1);
			this.scene.tweens.add({
				targets: this.messageText,
				scaleX: 1,
				scaleY: 1,
				duration: 400,
				ease: 'Back.easeOut'
			});

			// Animate points text
			this.pointsText.setAlpha(0);
			this.scene.tweens.add({
				targets: this.pointsText,
				alpha: 1,
				duration: 400,
				delay: 250
			});

			if (isCorrect) {
				// Celebration effects
				this.createConfetti();
				this.createStarBurst();
			} else {
				// Gentle shake for incorrect
				this.scene.tweens.add({
					targets: this.messageText,
					x: this.screenWidth / 2 + 8,
					duration: 50,
					delay: 400,
					yoyo: true,
					repeat: 2,
					ease: 'Sine.easeInOut',
					onComplete: () => {
						this.messageText.setX(this.screenWidth / 2);
					}
				});
			}

			// Guard against the Phaser timer and the wall-clock fallback both firing.
			let hideStarted = false;
			const doHideAndResolve = () => {
				if (hideStarted) return;
				hideStarted = true;
				this.hide().then(() => {
					this.emit(FeedbackOverlay.EVENTS.FEEDBACK_COMPLETE, type);
					resolve();
				});
			};

			// Primary: Phaser game timer (correct visual timing in real browsers at 60 fps).
			this.scene.time.delayedCall(duration, doHideAndResolve);
			// Fallback: wall-clock timer so the Promise resolves promptly in headless Docker
			// where Chrome throttles requestAnimationFrame to ~0.2 fps. Phaser's deltaMax cap
			// means a 1500 ms game-time delay accumulates at ≤200 ms/frame, costing ~37 s of
			// real time at that frame rate. setTimeout bypasses rAF entirely. The +500 ms grace
			// period lets the Phaser path win in normal (60 fps) browsers.
			setTimeout(doHideAndResolve, duration + 500);
		});
	}

	hide(): Promise<void> {
		return new Promise((resolve) => {
			let resolved = false;
			const doResolve = () => {
				if (resolved) return;
				resolved = true;
				this.setVisible(false);
				this.cleanup();
				resolve();
			};

			this.scene.tweens.add({
				targets: [this.overlay, this.messageText, this.pointsText],
				alpha: 0,
				duration: 300,
				onComplete: doResolve
			});
			// Wall-clock fallback: 350 ms covers the 300 ms tween duration even when the
			// Phaser game loop is throttled in Docker headless.
			setTimeout(doResolve, 350);
		});
	}

	// ============================================
	// Celebration Effects
	// ============================================

	private createConfetti(): void {
		const colors = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0x95E1D3, 0xF38181, 0xAA96DA];

		// Create multiple confetti pieces
		for (let i = 0; i < 50; i++) {
			const x = Phaser.Math.Between(0, this.screenWidth);
			const confetti = this.scene.add.rectangle(
				x,
				-20,
				Phaser.Math.Between(8, 15),
				Phaser.Math.Between(8, 15),
				colors[Math.floor(Math.random() * colors.length)]
			);
			confetti.setAngle(Phaser.Math.Between(0, 360));
			this.add(confetti);

			// Fall animation with rotation
			this.scene.tweens.add({
				targets: confetti,
				y: this.screenHeight + 50,
				x: x + Phaser.Math.Between(-100, 100),
				angle: Phaser.Math.Between(360, 720),
				duration: Phaser.Math.Between(1500, 2500),
				ease: 'Sine.easeIn',
				onComplete: () => confetti.destroy()
			});
		}
	}

	private createStarBurst(): void {
		const centerX = this.screenWidth / 2;
		const centerY = this.screenHeight / 2;

		for (let i = 0; i < 12; i++) {
			const angle = (i / 12) * Math.PI * 2;
			const starGfx = this.scene.add.graphics();
			drawStar(starGfx, 0, 0, 16, {
				fillColor: 0xFFD54F,
				strokeColor: 0xF9A825,
				strokeWidth: 2
			});
			starGfx.setPosition(centerX, centerY);
			starGfx.setScale(0);
			this.add(starGfx);

			this.scene.tweens.add({
				targets: starGfx,
				x: centerX + Math.cos(angle) * 200,
				y: centerY + Math.sin(angle) * 200,
				scaleX: 1, scaleY: 1,
				alpha: { from: 1, to: 0 },
				duration: 800,
				delay: i * 30,
				ease: 'Power2',
				onComplete: () => starGfx.destroy()
			});
		}
	}

	private cleanup(): void {
		// Remove any lingering particle effects
		if (this.particles) {
			this.particles.stop();
			this.particles = null;
		}
	}
}
