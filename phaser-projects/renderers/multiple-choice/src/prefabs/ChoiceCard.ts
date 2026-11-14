import Phaser from 'phaser';
import {
	QuestionChoice,
	ThemeConfig,
	DEFAULT_THEME,
	AudioManager,
	AssetResolver,
	drawCheckBadge,
	drawCrossBadge,
	GAME_FONT
} from '@edu-play/game-core';

export type ChoiceCardState = 'idle' | 'hover' | 'selected' | 'correct' | 'incorrect' | 'disabled';

export interface ChoiceCardConfig {
	x: number;
	y: number;
	width?: number;
	height?: number;
	choice: QuestionChoice;
	index: number;
	theme?: ThemeConfig;
	audioManager?: AudioManager;
}

export default class ChoiceCard extends Phaser.GameObjects.Container {
	private bg!: Phaser.GameObjects.Graphics;
	private shadow!: Phaser.GameObjects.Graphics;
	private content: Phaser.GameObjects.Image | Phaser.GameObjects.Text | null = null;
	private badgeGraphics: Phaser.GameObjects.Graphics | null = null;
	private breatheTween: Phaser.Tweens.Tween | null = null;
	private breatheTimer: Phaser.Time.TimerEvent | null = null;

	private choice: QuestionChoice;
	private cardIndex: number;
	private theme: ThemeConfig;
	private currentState: ChoiceCardState = 'idle';
	private cardWidth: number;
	private cardHeight: number;
	private audioManager: AudioManager;

	private readonly RADIUS = 20;
	private readonly SHADOW_OFFSET = 6;
	private readonly SHADOW_COLOR_IDLE = 0xCCCCCC;

	static readonly EVENTS = {
		SELECTED: 'choice-selected',
		HOVER_START: 'choice-hover-start',
		HOVER_END: 'choice-hover-end'
	} as const;

	constructor(scene: Phaser.Scene, config: ChoiceCardConfig) {
		super(scene, config.x, config.y);
		this.choice = config.choice;
		this.cardIndex = config.index;
		this.theme = config.theme ?? DEFAULT_THEME;
		this.cardWidth = config.width ?? 200;
		this.cardHeight = config.height ?? 200;
		this.audioManager = config.audioManager ?? AudioManager.getInstance();

		this.createCard();
		this.setupInteractivity();

		scene.add.existing(this as Phaser.GameObjects.Container);
	}

	private createCard(): void {
		// Shadow layer (behind everything)
		this.shadow = this.scene.add.graphics();
		this.drawShadow(this.SHADOW_COLOR_IDLE, this.SHADOW_OFFSET);
		this.add(this.shadow);

		// Main card background
		this.bg = this.scene.add.graphics();
		this.drawBackground(0xFFFFFF);
		this.add(this.bg);

		// Content
		this.createContent();

		// Set interactive area
		this.setSize(this.cardWidth, this.cardHeight);
		this.setInteractive({ useHandCursor: true });
	}

	private drawBackground(fillColor: number, strokeColor?: number, strokeWidth?: number): void {
		this.bg.clear();
		this.bg.fillStyle(fillColor, 1);
		this.bg.fillRoundedRect(
			-this.cardWidth / 2, -this.cardHeight / 2,
			this.cardWidth, this.cardHeight,
			this.RADIUS
		);
		if (strokeColor !== undefined && strokeWidth) {
			this.bg.lineStyle(strokeWidth, strokeColor, 1);
			this.bg.strokeRoundedRect(
				-this.cardWidth / 2, -this.cardHeight / 2,
				this.cardWidth, this.cardHeight,
				this.RADIUS
			);
		}
	}

	private drawShadow(color: number, offset: number): void {
		this.shadow.clear();
		this.shadow.fillStyle(color, 1);
		this.shadow.fillRoundedRect(
			-this.cardWidth / 2, -this.cardHeight / 2 + offset,
			this.cardWidth, this.cardHeight,
			this.RADIUS
		);
	}

	private createContent(): void {
		const padding = 20;
		const contentSize = Math.min(this.cardWidth, this.cardHeight) - padding * 2;

		if (this.choice.type === 'image') {
			this.content = this.createImageContent(this.choice.value);
			if (this.content) {
				const scale = contentSize / Math.max(this.content.width, this.content.height);
				this.content.setScale(Math.min(scale, 1));
			}
		} else {
			this.content = this.scene.add.text(0, 0, this.choice.value, {
				fontFamily: GAME_FONT,
				fontSize: '28px',
				fontStyle: 'bold',
				color: '#1A237E',
				align: 'center',
				wordWrap: { width: this.cardWidth - padding * 2 }
			});
			this.content.setOrigin(0.5);
		}

		if (this.content) {
			this.add(this.content);
		}
	}

	private createImageContent(assetKey: string): Phaser.GameObjects.Image | null {
		const assetResolver = AssetResolver.getInstance();
		if (assetResolver.isSpritesheetMode()) {
			const atlasKey = this.findAtlasForFrame(assetKey);
			if (atlasKey && this.scene.textures.exists(atlasKey)) {
				const atlas = this.scene.textures.get(atlasKey);
				if (atlas.has(assetKey)) {
					return this.scene.add.image(0, 0, atlasKey, assetKey);
				}
			}
		}
		if (this.scene.textures.exists(assetKey)) {
			return this.scene.add.image(0, 0, assetKey);
		}
		console.warn(`ChoiceCard: Asset "${assetKey}" not found`);
		return this.scene.add.image(0, 0, '__DEFAULT');
	}

	private findAtlasForFrame(frameKey: string): string | null {
		const atlasPatterns = [
			'animals-atlas', 'food-atlas', 'objects-atlas',
			'nature-atlas', 'places-atlas', 'people-atlas', 'actions-atlas'
		];
		for (const atlasKey of atlasPatterns) {
			if (this.scene.textures.exists(atlasKey)) {
				const atlas = this.scene.textures.get(atlasKey);
				if (atlas.has(frameKey)) return atlasKey;
			}
		}
		return null;
	}

	// --- Idle breathe animation ---

	private startBreathe(randomDelay: boolean = false): void {
		this.stopBreathe();
		const delay = randomDelay ? Phaser.Math.Between(0, 1000) : 0;
		this.breatheTimer = this.scene.time.delayedCall(delay, () => {
			this.breatheTimer = null;
			if (this.currentState !== 'idle') return;
			this.breatheTween = this.scene.tweens.add({
				targets: this,
				scaleX: 1.02,
				scaleY: 1.02,
				duration: 1000,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1,
			});
		});
	}

	private stopBreathe(resetScale: boolean = false): void {
		if (this.breatheTimer) {
			this.breatheTimer.destroy();
			this.breatheTimer = null;
		}
		if (this.breatheTween) {
			this.breatheTween.stop();
			this.breatheTween = null;
		}
		if (resetScale) {
			this.setScale(1);
		}
	}

	// --- Interactivity ---

	private setupInteractivity(): void {
		this.on('pointerover', this.onPointerOver, this);
		this.on('pointerout', this.onPointerOut, this);
		this.on('pointerdown', this.onPointerDown, this);
		this.on('pointerup', this.onPointerUp, this);
	}

	private onPointerOver(): void {
		if (this.currentState !== 'idle') return;
		this.stopBreathe();
		this.setCardState('hover');
		this.emit(ChoiceCard.EVENTS.HOVER_START, this);

		this.scene.tweens.add({
			targets: this,
			scaleX: 1.12, scaleY: 1.12,
			duration: 150,
			ease: 'Back.easeOut'
		});
		this.drawShadow(0xFFD54F, this.SHADOW_OFFSET);
	}

	private onPointerOut(): void {
		if (this.currentState !== 'hover') return;
		this.setCardState('idle');
		this.emit(ChoiceCard.EVENTS.HOVER_END, this);

		this.scene.tweens.add({
			targets: this,
			scaleX: 1, scaleY: 1,
			duration: 150,
			ease: 'Back.easeOut'
		});
		this.drawShadow(this.SHADOW_COLOR_IDLE, this.SHADOW_OFFSET);
		this.startBreathe();
	}

	private onPointerDown(): void {
		if (this.currentState !== 'hover' && this.currentState !== 'idle') return;

		this.scene.tweens.add({
			targets: this,
			scaleX: 0.95, scaleY: 0.95, y: this.y + 4,
			duration: 80,
			ease: 'Power2'
		});
		this.drawShadow(this.SHADOW_COLOR_IDLE, 2);
	}

	private onPointerUp(): void {
		if (this.currentState === 'disabled' || this.currentState === 'correct' || this.currentState === 'incorrect') return;
		this.setCardState('selected');
		this.audioManager.playSfx('click');

		this.scene.tweens.add({
			targets: this,
			scaleX: 1.05, scaleY: 1.05, y: this.y - 4,
			duration: 100,
			ease: 'Back.easeOut',
			onComplete: () => {
				this.emit(ChoiceCard.EVENTS.SELECTED, {
					card: this,
					choice: this.choice,
					index: this.cardIndex,
					isCorrect: this.choice.isCorrect
				});
			}
		});
		this.drawShadow(this.SHADOW_COLOR_IDLE, this.SHADOW_OFFSET);
	}

	// --- Feedback states ---

	showCorrect(): void {
		this.setCardState('correct');
		this.stopBreathe(true);
		this.disableInteractive();

		this.drawBackground(0xE8F5E9, 0x4CAF50, 3);
		this.drawShadow(0x4CAF50, this.SHADOW_OFFSET);

		this.scene.tweens.add({
			targets: this,
			scaleX: 1.15, scaleY: 1.15,
			duration: 200,
			ease: 'Back.easeOut',
			yoyo: true
		});

		this.scene.tweens.add({
			targets: this.shadow,
			alpha: { from: 1, to: 0.4 },
			duration: 300,
			yoyo: true,
			repeat: 1
		});

		this.showBadge('check');
	}

	showIncorrect(): void {
		this.setCardState('incorrect');
		this.stopBreathe(true);
		this.disableInteractive();

		this.drawBackground(0xFFEBEE, 0xE53935, 3);
		this.drawShadow(0xE53935, this.SHADOW_OFFSET);

		this.scene.tweens.add({
			targets: this,
			x: this.x + 8,
			duration: 60,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: 2
		});

		this.showBadge('cross');
	}

	showAsCorrectAnswer(): void {
		const correctColor = this.theme.correctColor ?? 0x4CAF50;
		this.drawBackground(0xE8F5E9, correctColor, 3);
		this.drawShadow(correctColor, this.SHADOW_OFFSET);

		this.scene.tweens.add({
			targets: this,
			scaleX: 1.08, scaleY: 1.08,
			duration: 400,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: 2
		});
	}

	private showBadge(type: 'check' | 'cross'): void {
		this.badgeGraphics = this.scene.add.graphics();
		const bx = this.cardWidth / 2 - 8;
		const by = -this.cardHeight / 2 + 8;
		const radius = 14;

		if (type === 'check') {
			drawCheckBadge(this.badgeGraphics, bx, by, radius);
		} else {
			drawCrossBadge(this.badgeGraphics, bx, by, radius);
		}

		this.badgeGraphics.setScale(0);
		this.add(this.badgeGraphics);

		this.scene.tweens.add({
			targets: this.badgeGraphics,
			scaleX: 1, scaleY: 1,
			duration: 300,
			ease: 'Back.easeOut'
		});
	}

	disable(): void {
		this.setCardState('disabled');
		this.stopBreathe(true);
		this.disableInteractive();
		this.scene.tweens.add({ targets: this, alpha: 0.5, duration: 200 });
	}

	enable(): void {
		this.setCardState('idle');
		this.setInteractive({ useHandCursor: true });
		this.setAlpha(1);
		this.startBreathe();
	}

	reset(): void {
		this.setCardState('idle');
		this.setInteractive({ useHandCursor: true });
		this.setScale(1);
		this.setAlpha(1);
		this.drawBackground(0xFFFFFF);
		this.drawShadow(this.SHADOW_COLOR_IDLE, this.SHADOW_OFFSET);
		if (this.content) this.content.setAlpha(1);
		if (this.badgeGraphics) {
			this.badgeGraphics.destroy();
			this.badgeGraphics = null;
		}
		this.startBreathe();
	}

	// --- Entrance/Exit ---

	animateIn(delay: number = 0): void {
		this.setScale(0);
		this.setAlpha(0);
		const targetY = this.y;
		this.setY(targetY + 80);

		this.scene.tweens.add({
			targets: this,
			scaleX: 1, scaleY: 1,
			alpha: 1,
			y: targetY,
			duration: 400,
			delay,
			ease: 'Back.easeOut',
			onComplete: () => {
				if (this.currentState === 'idle') {
					this.startBreathe(true);
				}
			}
		});
		// Wall-clock fallback: ensures scaleX reaches 1.0 even when rAF is
		// throttled in Docker headless, so waitForNotProcessing() scaleX check passes.
		setTimeout(() => {
			if (this.scaleX < 0.95) {
				this.setScale(1);
				this.setAlpha(1);
				this.setY(targetY);
				if (this.currentState === 'idle') {
					this.startBreathe(true);
				}
			}
		}, delay + 500);
	}

	animateOut(delay: number = 0): Promise<void> {
		return new Promise((resolve) => {
			this.stopBreathe(true);
			let resolved = false;
			const doResolve = () => {
				if (resolved) return;
				resolved = true;
				resolve();
			};
			this.scene.tweens.add({
				targets: this,
				y: this.y + 120,
				alpha: 0,
				angle: Phaser.Math.Between(-15, 15),
				duration: 400,
				delay,
				ease: 'Quad.easeIn',
				onComplete: doResolve
			});
			// Wall-clock fallback so proceedToNext() is not blocked when Phaser's
			// game loop is throttled by Chrome headless rAF in Docker.
			setTimeout(doResolve, delay + 450);
		});
	}

	// --- Keyboard focus ---

	showFocus(): void {
		if (this.currentState === 'hover') {
			// Already showing hover visuals (gold shadow, scale 1.12) — nothing extra needed
			return;
		}
		if (this.currentState !== 'idle') return;
		this.stopBreathe();
		this.scene.tweens.add({
			targets: this, scaleX: 1.12, scaleY: 1.12,
			duration: 150, ease: 'Back.easeOut'
		});
		this.drawShadow(0xFFD54F, this.SHADOW_OFFSET);
	}

	hideFocus(): void {
		if (this.currentState === 'hover') {
			// Mouse is still over the card — leave hover visuals intact
			return;
		}
		if (this.currentState !== 'idle') return;
		this.scene.tweens.add({
			targets: this, scaleX: 1, scaleY: 1,
			duration: 150, ease: 'Back.easeOut'
		});
		this.drawShadow(this.SHADOW_COLOR_IDLE, this.SHADOW_OFFSET);
		this.startBreathe();
	}

	selectViaKeyboard(): void {
		if (this.currentState === 'disabled' || this.currentState === 'correct' || this.currentState === 'incorrect') return;
		this.setCardState('selected');
		this.audioManager.playSfx('click');
		this.emit(ChoiceCard.EVENTS.SELECTED, {
			card: this,
			choice: this.choice,
			index: this.cardIndex,
			isCorrect: this.choice.isCorrect
		});
	}

	getAccessibleLabel(): string {
		const choiceNumber = this.cardIndex + 1;
		if (this.choice.type === 'image') {
			return this.choice.label || `Choice ${choiceNumber}: ${this.choice.value}`;
		}
		return `Choice ${choiceNumber}: ${this.choice.value}`;
	}

	getChoice(): QuestionChoice { return this.choice; }
	getIndex(): number { return this.cardIndex; }
	getState(): ChoiceCardState { return this.currentState; }
	isCorrect(): boolean { return this.choice.isCorrect; }
	private setCardState(state: ChoiceCardState): void { this.currentState = state; }
}
