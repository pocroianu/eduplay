import Phaser from 'phaser';
import { ThemeConfig, DEFAULT_THEME } from '../types/GameConfig';
import { drawStar } from '../utils/GraphicsUtils';
import { GAME_FONT } from '../utils/FontLoader';

export interface ProgressIndicatorConfig {
	x: number;
	y: number;
	totalSteps: number;
	theme?: ThemeConfig;
	style?: 'dots' | 'stars' | 'bar';
}

/**
 * ProgressIndicator - Shows current progress through questions
 * Supports dots, stars, or bar styles with animations
 */
export default class ProgressIndicator extends Phaser.GameObjects.Container {
	private theme: ThemeConfig;
	private totalSteps: number;
	private currentStep: number = 0;
	private style: 'dots' | 'stars' | 'bar';

	private indicators: Phaser.GameObjects.Container[] = [];
	private progressBar: Phaser.GameObjects.Rectangle | null = null;
	private progressBarFill: Phaser.GameObjects.Rectangle | null = null;
	private stepLabel: Phaser.GameObjects.Text | null = null;

	constructor(scene: Phaser.Scene, config: ProgressIndicatorConfig) {
		super(scene, config.x, config.y);

		this.theme = config.theme ?? DEFAULT_THEME;
		this.totalSteps = config.totalSteps;
		this.style = config.style ?? 'stars';

		this.createIndicator();

		scene.add.existing(this);
	}

	private createIndicator(): void {
		switch (this.style) {
			case 'dots':
				this.createDots();
				break;
			case 'stars':
				this.createStars();
				break;
			case 'bar':
				this.createBar();
				break;
		}

		// Step label
		this.stepLabel = this.scene.add.text(0, 40, '', {
			fontFamily: GAME_FONT,
			fontSize: '20px',
			fontStyle: 'bold',
			color: this.theme.textColor
		});
		this.stepLabel.setOrigin(0.5);
		this.add(this.stepLabel);
		this.updateLabel();
	}

	private createDots(): void {
		const spacing = 40;
		const startX = -((this.totalSteps - 1) * spacing) / 2;

		for (let i = 0; i < this.totalSteps; i++) {
			const dot = this.scene.add.container(startX + i * spacing, 0);

			// Outer ring
			const ring = this.scene.add.circle(0, 0, 15, 0x000000, 0);
			ring.setStrokeStyle(3, this.theme.primary);

			// Inner fill (hidden initially)
			const fill = this.scene.add.circle(0, 0, 10, this.theme.secondary);
			fill.setAlpha(0);
			fill.setName('fill');

			dot.add([ring, fill]);
			this.indicators.push(dot);
			this.add(dot);
		}
	}

	private createStars(): void {
		const spacing = 50;
		const startX = -((this.totalSteps - 1) * spacing) / 2;

		for (let i = 0; i < this.totalSteps; i++) {
			const star = this.scene.add.container(startX + i * spacing, 0);

			// Empty star outline (gray)
			const outlineGfx = this.scene.add.graphics();
			drawStar(outlineGfx, 0, 0, 18, {
				fillColor: 0x666666,
				strokeColor: 0x444444,
				strokeWidth: 2
			});
			outlineGfx.setName('outline');
			star.add(outlineGfx);

			// Filled star (hidden initially)
			const filledGfx = this.scene.add.graphics();
			drawStar(filledGfx, 0, 0, 18, {
				fillColor: 0xFFD54F,
				strokeColor: 0xF9A825,
				strokeWidth: 2
			});
			filledGfx.setName('filled');
			filledGfx.setAlpha(0);
			filledGfx.setScale(0);
			star.add(filledGfx);

			this.indicators.push(star);
			this.add(star);
		}
	}

	private createBar(): void {
		const barWidth = 300;
		const barHeight = 20;

		// Background
		this.progressBar = this.scene.add.rectangle(0, 0, barWidth, barHeight, 0x333333);
		this.progressBar.setStrokeStyle(2, this.theme.primary);
		this.add(this.progressBar);

		// Fill
		this.progressBarFill = this.scene.add.rectangle(
			-barWidth / 2,
			0,
			0,
			barHeight - 4,
			this.theme.secondary
		);
		this.progressBarFill.setOrigin(0, 0.5);
		this.add(this.progressBarFill);
	}

	private updateLabel(): void {
		if (this.stepLabel) {
			this.stepLabel.setText(`${this.currentStep} / ${this.totalSteps}`);
		}
	}

	// ============================================
	// Public Methods
	// ============================================

	setStep(step: number, animate: boolean = true): void {
		const previousStep = this.currentStep;
		this.currentStep = Math.min(step, this.totalSteps);
		this.updateLabel();

		if (this.style === 'bar') {
			this.updateBar(animate);
		} else {
			// Update indicators for steps that changed
			for (let i = previousStep; i < this.currentStep; i++) {
				this.fillIndicator(i, animate);
			}
		}
	}

	completeStep(stepIndex: number, wasCorrect: boolean = true): void {
		if (stepIndex >= this.indicators.length) return;

		const indicator = this.indicators[stepIndex];

		if (this.style === 'stars') {
			const filled = indicator.getByName('filled') as Phaser.GameObjects.Graphics;
			const outline = indicator.getByName('outline') as Phaser.GameObjects.Graphics;

			if (wasCorrect) {
				// Gold star with celebration
				this.animateStarIn(filled, outline);
			} else {
				// Gray star (completed but wrong)
				filled.setAlpha(0.5);
				this.scene.tweens.add({
					targets: filled,
					alpha: 0.5,
					scaleX: 1,
					scaleY: 1,
					duration: 200
				});
			}
		} else if (this.style === 'dots') {
			const fill = indicator.getByName('fill') as Phaser.GameObjects.Arc;
			fill.fillColor = wasCorrect ? (this.theme.correctColor ?? 0x22C55E) : (this.theme.incorrectColor ?? 0xEF4444);
			this.scene.tweens.add({
				targets: fill,
				alpha: 1,
				duration: 200
			});
		}

		this.currentStep = stepIndex + 1;
		this.updateLabel();

		if (this.style === 'bar') {
			this.updateBar(true);
		}
	}

	private fillIndicator(index: number, animate: boolean): void {
		if (index >= this.indicators.length) return;

		const indicator = this.indicators[index];

		if (this.style === 'stars') {
			const filled = indicator.getByName('filled') as Phaser.GameObjects.Graphics;
			const outline = indicator.getByName('outline') as Phaser.GameObjects.Graphics;

			if (animate) {
				this.animateStarIn(filled, outline);
			} else {
				filled.setAlpha(1);
				filled.setScale(1);
				outline.setAlpha(0);
			}
		} else if (this.style === 'dots') {
			const fill = indicator.getByName('fill') as Phaser.GameObjects.Arc;

			if (animate) {
				this.scene.tweens.add({
					targets: fill,
					alpha: 1,
					duration: 300,
					ease: 'Back.easeOut'
				});
			} else {
				fill.setAlpha(1);
			}
		}
	}

	private animateStarIn(filled: Phaser.GameObjects.Graphics, outline: Phaser.GameObjects.Graphics): void {
		// Pop in animation for star
		this.scene.tweens.add({
			targets: filled,
			alpha: 1,
			scaleX: 1.3,
			scaleY: 1.3,
			duration: 200,
			ease: 'Back.easeOut',
			onComplete: () => {
				this.scene.tweens.add({
					targets: filled,
					scaleX: 1,
					scaleY: 1,
					duration: 150,
					ease: 'Bounce.easeOut'
				});
			}
		});

		// Fade out outline
		this.scene.tweens.add({
			targets: outline,
			alpha: 0,
			duration: 200
		});

		// Sparkle effect around star
		this.createSparkles(filled.x + this.indicators[this.currentStep - 1]?.x || 0, filled.y);
	}

	private createSparkles(x: number, y: number): void {
		const colors = [0xFBBF24, 0xFFFFFF, 0xFDE68A];

		for (let i = 0; i < 6; i++) {
			const angle = (i / 6) * Math.PI * 2;
			const sparkle = this.scene.add.circle(
				x + Math.cos(angle) * 10,
				y + Math.sin(angle) * 10,
				4,
				colors[i % colors.length]
			);
			this.add(sparkle);

			this.scene.tweens.add({
				targets: sparkle,
				x: x + Math.cos(angle) * 40,
				y: y + Math.sin(angle) * 40,
				alpha: 0,
				scale: 0,
				duration: 400,
				ease: 'Power2',
				onComplete: () => sparkle.destroy()
			});
		}
	}

	private updateBar(animate: boolean): void {
		if (!this.progressBarFill || !this.progressBar) return;

		const targetWidth = (this.currentStep / this.totalSteps) * (this.progressBar.width - 4);

		if (animate) {
			this.scene.tweens.add({
				targets: this.progressBarFill,
				width: targetWidth,
				duration: 300,
				ease: 'Power2'
			});
		} else {
			this.progressBarFill.width = targetWidth;
		}
	}

	reset(): void {
		this.currentStep = 0;
		this.updateLabel();

		if (this.style === 'bar') {
			if (this.progressBarFill) {
				this.progressBarFill.width = 0;
			}
		} else {
			this.indicators.forEach(indicator => {
				if (this.style === 'stars') {
					const filled = indicator.getByName('filled') as Phaser.GameObjects.Graphics;
					const outline = indicator.getByName('outline') as Phaser.GameObjects.Graphics;
					filled.setAlpha(0);
					filled.setScale(0);
					outline.setAlpha(1);
				} else {
					const fill = indicator.getByName('fill') as Phaser.GameObjects.Arc;
					fill.setAlpha(0);
				}
			});
		}
	}

	// ============================================
	// Animations
	// ============================================

	animateIn(delay: number = 0): void {
		this.setAlpha(0);
		this.setY(this.y - 30);

		this.scene.tweens.add({
			targets: this,
			alpha: 1,
			y: this.y + 30,
			duration: 400,
			delay,
			ease: 'Back.easeOut'
		});
	}

	celebrateAll(): void {
		// All stars/dots do a wave animation
		this.indicators.forEach((indicator, index) => {
			this.scene.tweens.add({
				targets: indicator,
				y: -15,
				duration: 200,
				delay: index * 100,
				ease: 'Sine.easeOut',
				yoyo: true,
				repeat: 1
			});
		});
	}
}
