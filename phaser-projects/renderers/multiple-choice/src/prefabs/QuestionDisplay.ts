import Phaser from 'phaser';
import {
	QuestionContent,
	ThemeConfig,
	DEFAULT_THEME,
	drawSpeakerIcon,
	GAME_FONT
} from '@edu-play/game-core';

export interface QuestionDisplayConfig {
	x: number;
	y: number;
	width?: number;
	height?: number;
	theme?: ThemeConfig;
	mascotKey?: string;
}

/**
 * QuestionDisplay - Displays question text with optional audio playback
 * Features a speech bubble style with optional mascot character
 */
export default class QuestionDisplay extends Phaser.GameObjects.Container {
	private questionText!: Phaser.GameObjects.Text;
	private audioButton: Phaser.GameObjects.Container | null = null;
	private mascot: Phaser.GameObjects.Image | null = null;

	private theme: ThemeConfig;
	private panelWidth: number;
	private panelHeight: number;
	private currentAudioKey: string | null = null;
	private currentSound: Phaser.Sound.BaseSound | null = null;

	static readonly EVENTS = {
		AUDIO_PLAY: 'audio-play',
		AUDIO_COMPLETE: 'audio-complete'
	} as const;

	constructor(scene: Phaser.Scene, config: QuestionDisplayConfig) {
		super(scene, config.x, config.y);

		this.theme = config.theme ?? DEFAULT_THEME;
		this.panelWidth = config.width ?? 800;
		this.panelHeight = config.height ?? 150;

		this.createDisplay(config.mascotKey);

		scene.add.existing(this);
	}

	private createDisplay(mascotKey?: string): void {
		// Use container colors for better contrast
		const bgColor = this.theme.containerBg ?? 0xFFFFFF;
		const textColor = this.theme.containerText ?? '#1F2937';

		// Drop shadow
		const shadowGfx = this.scene.add.graphics();
		shadowGfx.fillStyle(0x000000, 0.1);
		shadowGfx.fillRoundedRect(
			-this.panelWidth / 2 + 4, -this.panelHeight / 2 + 6,
			this.panelWidth, this.panelHeight, 24
		);
		this.add(shadowGfx);

		// Main background (rounded)
		const bgGfx = this.scene.add.graphics();
		bgGfx.fillStyle(bgColor, 1);
		bgGfx.fillRoundedRect(
			-this.panelWidth / 2, -this.panelHeight / 2,
			this.panelWidth, this.panelHeight, 24
		);
		this.add(bgGfx);

		// Speech bubble tail — points LEFT toward mascot
		const tailGfx = this.scene.add.graphics();
		tailGfx.fillStyle(bgColor, 1);
		tailGfx.fillTriangle(
			-this.panelWidth / 2 - 12, 0,
			-this.panelWidth / 2, -12,
			-this.panelWidth / 2, 12
		);
		this.add(tailGfx);

		// Question text
		this.questionText = this.scene.add.text(0, 0, '', {
			fontFamily: GAME_FONT,
			fontSize: '32px',
			fontStyle: 'bold',
			color: textColor,
			align: 'center',
			wordWrap: { width: this.panelWidth - 140 }
		});
		this.questionText.setOrigin(0.5);
		this.add(this.questionText);

		// Audio play button
		this.createAudioButton();

		// Optional mascot
		if (mascotKey) {
			this.createMascot(mascotKey);
		}
	}

	private createAudioButton(): void {
		this.audioButton = this.scene.add.container(this.panelWidth / 2 - 50, 0);

		// Circle background for audio button
		const btnBg = this.scene.add.circle(0, 0, 35, this.theme.secondary);

		// Drawn speaker icon (no emoji)
		const iconGfx = this.scene.add.graphics();
		drawSpeakerIcon(iconGfx, 0, 0, 50, 0xFFFFFF);

		this.audioButton.add([btnBg, iconGfx]);
		this.audioButton.setSize(80, 80);
		this.audioButton.setInteractive({ useHandCursor: true });

		// Hover effects
		this.audioButton.on('pointerover', () => {
			this.scene.tweens.add({
				targets: this.audioButton,
				scaleX: 1.1,
				scaleY: 1.1,
				duration: 100,
				ease: 'Back.easeOut'
			});
		});

		this.audioButton.on('pointerout', () => {
			this.scene.tweens.add({
				targets: this.audioButton,
				scaleX: 1,
				scaleY: 1,
				duration: 100
			});
		});

		this.audioButton.on('pointerdown', () => {
			this.playAudio();
			this.scene.tweens.add({
				targets: this.audioButton,
				angle: 360,
				duration: 300,
				ease: 'Cubic.easeOut',
				onComplete: () => { this.audioButton?.setAngle(0); }
			});
		});

		this.audioButton.setAlpha(0); // Hidden until audio is set
		this.add(this.audioButton);
	}

	private createMascot(mascotKey: string): void {
		this.mascot = this.scene.add.image(
			-this.panelWidth / 2 - 60,
			0,
			mascotKey
		);
		// Scale mascot to reasonable size
		const maxSize = this.panelHeight * 0.8;
		const scale = maxSize / Math.max(this.mascot.width, this.mascot.height);
		this.mascot.setScale(Math.min(scale, 1));
		this.add(this.mascot);

		// Idle animation for mascot
		this.scene.tweens.add({
			targets: this.mascot,
			y: -5,
			duration: 1000,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1
		});
	}

	// ============================================
	// Public Methods
	// ============================================

	setQuestion(content: QuestionContent): void {
		this.questionText.setText(content.text);

		// Handle audio
		if (content.audio) {
			this.currentAudioKey = content.audio;
			this.audioButton?.setAlpha(1);
		} else {
			this.currentAudioKey = null;
			this.audioButton?.setAlpha(0);
		}

		// Animate text in
		this.questionText.setAlpha(0);
		this.questionText.setScale(0.8);
		this.scene.tweens.add({
			targets: this.questionText,
			alpha: 1,
			scaleX: 1,
			scaleY: 1,
			duration: 300,
			ease: 'Back.easeOut'
		});
	}

	playAudio(): void {
		if (!this.currentAudioKey) return;

		// Stop any currently playing sound
		if (this.currentSound) {
			this.currentSound.stop();
		}

		try {
			this.currentSound = this.scene.sound.add(this.currentAudioKey);
			this.currentSound.play();

			this.emit(QuestionDisplay.EVENTS.AUDIO_PLAY, this.currentAudioKey);

			// Animate audio button while playing
			this.scene.tweens.add({
				targets: this.audioButton,
				scaleX: 1.15,
				scaleY: 1.15,
				duration: 200,
				yoyo: true,
				repeat: -1
			});

			this.currentSound.once('complete', () => {
				if (this.audioButton) {
					this.scene.tweens.killTweensOf(this.audioButton);
					this.audioButton.setScale(1);
				}
				this.emit(QuestionDisplay.EVENTS.AUDIO_COMPLETE, this.currentAudioKey);
			});
		} catch (e) {
			console.warn('Audio not found:', this.currentAudioKey);
		}
	}

	stopAudio(): void {
		if (this.currentSound) {
			this.currentSound.stop();
			this.currentSound = null;
		}
		if (this.audioButton) {
			this.scene.tweens.killTweensOf(this.audioButton);
			this.audioButton.setScale(1);
		}
	}

	setMascot(key: string): void {
		if (this.mascot) {
			this.mascot.setTexture(key);
		} else {
			this.createMascot(key);
		}
	}

	// ============================================
	// Animations
	// ============================================

	animateIn(delay: number = 0): void {
		this.setAlpha(0);
		this.setY(this.y - 50);

		this.scene.tweens.add({
			targets: this,
			alpha: 1,
			y: this.y + 50,
			duration: 400,
			delay,
			ease: 'Back.easeOut'
		});
	}

	animateOut(): Promise<void> {
		return new Promise((resolve) => {
			this.scene.tweens.add({
				targets: this,
				alpha: 0,
				y: this.y - 30,
				duration: 250,
				ease: 'Power2',
				onComplete: () => resolve()
			});
		});
	}

	celebrateMascot(): void {
		if (!this.mascot) return;

		// Stop idle animation
		this.scene.tweens.killTweensOf(this.mascot);

		// Happy jump!
		this.scene.tweens.add({
			targets: this.mascot,
			y: this.mascot.y - 30,
			scaleX: 1.2,
			scaleY: 1.2,
			duration: 200,
			ease: 'Back.easeOut',
			yoyo: true,
			repeat: 2,
			onComplete: () => {
				// Resume idle animation
				this.scene.tweens.add({
					targets: this.mascot,
					y: -5,
					duration: 1000,
					ease: 'Sine.easeInOut',
					yoyo: true,
					repeat: -1
				});
			}
		});
	}

	sadMascot(): void {
		if (!this.mascot) return;

		// Stop idle animation
		this.scene.tweens.killTweensOf(this.mascot);

		// Gentle shake
		this.scene.tweens.add({
			targets: this.mascot,
			angle: 5,
			duration: 100,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: 2,
			onComplete: () => {
				this.mascot?.setAngle(0);
				// Resume idle animation
				this.scene.tweens.add({
					targets: this.mascot,
					y: -5,
					duration: 1000,
					ease: 'Sine.easeInOut',
					yoyo: true,
					repeat: -1
				});
			}
		});
	}

	destroy(fromScene?: boolean): void {
		this.stopAudio();
		super.destroy(fromScene);
	}
}
