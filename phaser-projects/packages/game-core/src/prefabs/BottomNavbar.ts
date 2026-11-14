import Phaser from 'phaser';
import { ThemeConfig, DEFAULT_THEME } from '../types/GameConfig';
import i18n from '../i18n';
import { drawRepeatIcon, drawPauseIcon, drawPlayIcon, drawSpeakerIcon } from '../utils/GraphicsUtils';
import { GAME_FONT } from '../utils/FontLoader';

export interface BottomNavbarConfig {
	x: number;
	y: number;
	width?: number;
	height?: number;
	totalSteps: number;
	playerName?: string;
	theme?: ThemeConfig;
}

/**
 * BottomNavbar - Frosted pill navigation bar for kids with:
 * - Player name display (left)
 * - Repeat audio button (left-center)
 * - Progress dots indicator (center)
 * - Pause button (right)
 */
export default class BottomNavbar extends Phaser.GameObjects.Container {
	private theme: ThemeConfig;
	private navWidth: number;
	private navHeight: number;
	private totalSteps: number;
	private currentStep: number = 0;
	private playerName: string;

	// UI Elements
	private playerNameContainer!: Phaser.GameObjects.Container;
	private progressDots: Phaser.GameObjects.Arc[] = [];
	private repeatButton!: Phaser.GameObjects.Container;
	private pauseButton!: Phaser.GameObjects.Container;
	private isPaused: boolean = false;

	// Events
	static readonly EVENTS = {
		REPEAT_PRESSED: 'repeat-pressed',
		PAUSE_PRESSED:  'pause-pressed',
		RESUME_PRESSED: 'resume-pressed',
		AUTO_PAUSE:     'auto-pause',
		AUTO_RESUME:    'auto-resume'
	};

	constructor(scene: Phaser.Scene, config: BottomNavbarConfig) {
		super(scene, config.x, config.y);

		this.theme = config.theme ?? DEFAULT_THEME;
		this.navWidth = config.width ?? 1280;
		this.navHeight = config.height ?? 80;
		this.totalSteps = config.totalSteps;
		this.playerName = config.playerName ?? i18n.t('ui.player');

		this.createBackground();
		this.createPlayerName();
		this.createProgressBar();
		this.createRepeatButton();
		this.createPauseButton();

		scene.add.existing(this);
		this.setDepth(100); // Always on top
	}

	private createBackground(): void {
		const bg = this.scene.add.graphics();
		bg.fillStyle(0x000000, 0.2);
		bg.fillRoundedRect(
			-this.navWidth / 2 + 20, -this.navHeight / 2 + 4,
			this.navWidth - 40, this.navHeight - 8,
			20
		);
		this.add(bg);
	}

	private createPlayerName(): void {
		// Find the position where player name goes (left side of navbar)
		const leftX = -this.navWidth / 2 + 100;
		this.playerNameContainer = this.scene.add.container(leftX, 0);

		// Avatar circle (placeholder)
		const avatar = this.scene.add.circle(-20, 0, 16, 0xFFFFFF, 0.15);
		this.playerNameContainer.add(avatar);

		// Player name text using Nunito
		const nameText = this.scene.add.text(4, 0, this.playerName, {
			fontFamily: GAME_FONT,
			fontSize: '16px',
			fontStyle: 'bold',
			color: '#FFFFFF'
		});
		nameText.setOrigin(0, 0.5);
		this.playerNameContainer.add(nameText);

		this.add(this.playerNameContainer);
	}

	private createProgressBar(): void {
		const dotSpacing = 18;
		const startX = -((this.totalSteps - 1) * dotSpacing) / 2;

		for (let i = 0; i < this.totalSteps; i++) {
			const dot = this.scene.add.circle(
				startX + i * dotSpacing, 0,
				6,
				0xFFFFFF, 0.25
			);
			this.progressDots.push(dot);
			this.add(dot);
		}
	}

	private createRepeatButton(): void {
		const buttonX = -280;  // Left of progress bar

		this.repeatButton = this.scene.add.container(buttonX, 0);

		// Circular background
		const bg = this.scene.add.circle(0, 0, 30, 0x06FFA5);
		bg.setStrokeStyle(4, 0xFFFFFF);
		this.repeatButton.add(bg);

		// Drawn repeat icon
		const icon = this.scene.add.graphics();
		drawRepeatIcon(icon, 0, 0, 40);
		this.repeatButton.add(icon);

		// Make background interactive
		bg.setInteractive({ useHandCursor: true });
		bg.on('pointerover', () => {
			this.scene.tweens.add({
				targets: this.repeatButton,
				scaleX: 1.1,
				scaleY: 1.1,
				duration: 100,
				ease: 'Back.easeOut'
			});
		});
		bg.on('pointerout', () => {
			this.scene.tweens.add({
				targets: this.repeatButton,
				scaleX: 1,
				scaleY: 1,
				duration: 100
			});
		});
		bg.on('pointerdown', () => {
			this.onRepeatPressed();
		});

		this.add(this.repeatButton);
	}

	private createPauseButton(): void {
		const buttonX = 280;  // Right of progress bar

		this.pauseButton = this.scene.add.container(buttonX, 0);

		// Circular background
		const bg = this.scene.add.circle(0, 0, 30, 0xFF6B9D);
		bg.setStrokeStyle(4, 0xFFFFFF);
		bg.setData('bg', true);
		this.pauseButton.add(bg);

		// Drawn pause icon
		const icon = this.scene.add.graphics();
		icon.setData('icon', true);
		drawPauseIcon(icon, 0, 0, 40);
		this.pauseButton.add(icon);

		// Interactivity
		bg.setInteractive({ useHandCursor: true });
		bg.on('pointerover', () => {
			this.scene.tweens.add({
				targets: this.pauseButton,
				scaleX: 1.1,
				scaleY: 1.1,
				duration: 100,
				ease: 'Back.easeOut'
			});
		});
		bg.on('pointerout', () => {
			this.scene.tweens.add({
				targets: this.pauseButton,
				scaleX: 1,
				scaleY: 1,
				duration: 100
			});
		});
		bg.on('pointerdown', () => {
			this.onPausePressed();
		});

		this.add(this.pauseButton);
	}

	private onRepeatPressed(): void {
		// Pulse animation
		this.scene.tweens.add({
			targets: this.repeatButton,
			scaleX: 0.9,
			scaleY: 0.9,
			duration: 50,
			yoyo: true,
			onComplete: () => {
				this.emit(BottomNavbar.EVENTS.REPEAT_PRESSED);
			}
		});
	}

	private onPausePressed(): void {
		this.isPaused = !this.isPaused;

		// Update button icon
		const icon = this.pauseButton.list.find(
			(obj) => obj.getData && obj.getData('icon')
		) as Phaser.GameObjects.Graphics;

		icon.clear();
		if (this.isPaused) {
			drawPlayIcon(icon, 0, 0, 40);
			this.scene.tweens.pauseAll();
			this.emit(BottomNavbar.EVENTS.PAUSE_PRESSED);
			this.emit(BottomNavbar.EVENTS.AUTO_PAUSE);
		} else {
			drawPauseIcon(icon, 0, 0, 40);
			this.scene.tweens.resumeAll();
			this.emit(BottomNavbar.EVENTS.RESUME_PRESSED);
			this.emit(BottomNavbar.EVENTS.AUTO_RESUME);
			// Pulse only on resume (tweens are frozen while paused)
			this.scene.tweens.add({
				targets: this.pauseButton,
				scaleX: 0.9,
				scaleY: 0.9,
				duration: 50,
				yoyo: true
			});
		}
	}

	private updateProgressBar(): void {
		for (let i = 0; i < this.progressDots.length; i++) {
			const dot = this.progressDots[i];
			if (i < this.currentStep) {
				dot.fillColor = 0xFFD54F;
				dot.fillAlpha = 1;
			} else {
				dot.fillColor = 0xFFFFFF;
				dot.fillAlpha = 0.25;
			}
		}
	}

	// ============================================
	// Public Methods
	// ============================================

	setCurrentStep(step: number): void {
		this.currentStep = step;
		this.updateProgressBar();
	}

	completeStep(stepIndex: number, correct: boolean): void {
		this.currentStep = stepIndex + 1;
		this.updateProgressBar();
	}

	animateIn(delay: number = 0): void {
		this.setAlpha(0);
		this.y += 100;

		this.scene.tweens.add({
			targets: this,
			y: this.y - 100,
			alpha: 1,
			duration: 400,
			delay,
			ease: 'Back.easeOut'
		});
	}

	animateOut(): Promise<void> {
		return new Promise((resolve) => {
			this.scene.tweens.add({
				targets: this,
				y: this.y + 100,
				alpha: 0,
				duration: 300,
				ease: 'Power2',
				onComplete: () => resolve()
			});
		});
	}

	getIsPaused(): boolean {
		return this.isPaused;
	}

	reset(): void {
		const wasPaused = this.isPaused;
		this.currentStep = 0;
		this.isPaused = false;

		if (wasPaused) {
			this.scene.tweens.resumeAll();
		}

		// Reset dots
		this.progressDots.forEach(dot => {
			dot.fillColor = 0xFFFFFF;
			dot.fillAlpha = 0.25;
		});

		// Reset pause button icon
		const icon = this.pauseButton.list.find(
			(obj) => obj.getData && obj.getData('icon')
		) as Phaser.GameObjects.Graphics;
		if (icon) {
			drawPauseIcon(icon, 0, 0, 40);
		}
	}
}
