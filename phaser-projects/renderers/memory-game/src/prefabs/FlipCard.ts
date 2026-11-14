import Phaser from 'phaser';
import { ThemeConfig, GAME_FONT } from '@edu-play/game-core';

export type FlipCardState = 'faceDown' | 'faceUp' | 'matched';

export interface FlipCardConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    pairId: string;
    imageKey?: string;
    label: string;
    theme: ThemeConfig;
}

export default class FlipCard extends Phaser.GameObjects.Container {
    static readonly EVENTS = {
        FLIPPED: 'card-flipped'
    } as const;

    readonly pairId: string;
    readonly label: string;

    private cardBack: Phaser.GameObjects.Graphics;
    private cardFront: Phaser.GameObjects.Graphics;
    private img: Phaser.GameObjects.Image | null = null;
    private labelText: Phaser.GameObjects.Text | null = null;
    private focusRing: Phaser.GameObjects.Graphics;
    private cardWidth: number;
    private cardHeight: number;
    private theme: ThemeConfig;
    private currentState: FlipCardState = 'faceDown';
    private isFlipping = false;

    constructor(scene: Phaser.Scene, config: FlipCardConfig) {
        super(scene, config.x, config.y);

        this.pairId = config.pairId;
        this.label = config.label;
        this.cardWidth = config.width;
        this.cardHeight = config.height;
        this.theme = config.theme;

        // Card back (visible initially)
        this.cardBack = scene.add.graphics();
        this.drawCardBack();
        this.add(this.cardBack);

        // Card front (hidden initially)
        this.cardFront = scene.add.graphics();
        this.drawCardFront();
        this.cardFront.setVisible(false);
        this.add(this.cardFront);

        // Image or text label (hidden initially, part of front face)
        if (config.imageKey && scene.textures.exists(config.imageKey)) {
            this.img = scene.add.image(0, 0, config.imageKey);
            const maxW = config.width * 0.7;
            const maxH = config.height * 0.7;
            const scale = Math.min(maxW / this.img.width, maxH / this.img.height);
            this.img.setDisplaySize(this.img.width * scale, this.img.height * scale);
            this.img.setVisible(false);
            this.add(this.img);
        } else {
            this.labelText = scene.add.text(0, 0, config.label, {
                fontSize: `${Math.floor(config.height * 0.35)}px`,
                color: '#1F2937',
                fontFamily: GAME_FONT,
                fontStyle: 'bold',
                align: 'center'
            }).setOrigin(0.5);
            this.labelText.setVisible(false);
            this.add(this.labelText);
        }

        // Focus ring (hidden by default)
        this.focusRing = scene.add.graphics();
        this.focusRing.setVisible(false);
        this.add(this.focusRing);
        this.drawFocusRing();

        this.setSize(config.width, config.height);
        this.setInteractive({ useHandCursor: true });

        this.on('pointerover', this.onPointerOver, this);
        this.on('pointerout', this.onPointerOut, this);

        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    }

    getPairId(): string {
        return this.pairId;
    }

    getCardState(): FlipCardState {
        return this.currentState;
    }

    isFaceUp(): boolean {
        return this.currentState === 'faceUp';
    }

    isMatched(): boolean {
        return this.currentState === 'matched';
    }

    isLocked(): boolean {
        return this.isFlipping || this.currentState === 'matched' || this.currentState === 'faceUp';
    }

    flip(): Promise<void> {
        if (this.isLocked()) {
            return Promise.resolve();
        }

        this.isFlipping = true;
        this.currentState = 'faceUp';

        return new Promise((resolve) => {
            // First half: scale X to 0 (hide back)
            this.scene.tweens.add({
                targets: this,
                scaleX: 0,
                duration: 150,
                ease: 'Sine.easeIn',
                onComplete: () => {
                    // Swap visuals at midpoint
                    this.cardBack.setVisible(false);
                    this.cardFront.setVisible(true);
                    if (this.img) this.img.setVisible(true);
                    if (this.labelText) this.labelText.setVisible(true);

                    // Second half: scale X back to 1 (reveal front)
                    this.scene.tweens.add({
                        targets: this,
                        scaleX: 1,
                        duration: 150,
                        ease: 'Sine.easeOut',
                        onComplete: () => {
                            this.isFlipping = false;
                            resolve();
                        }
                    });
                }
            });
        });
    }

    flipBack(): Promise<void> {
        if (this.currentState === 'matched') {
            return Promise.resolve();
        }

        this.isFlipping = true;

        return new Promise((resolve) => {
            // First half: scale X to 0 (hide front)
            this.scene.tweens.add({
                targets: this,
                scaleX: 0,
                duration: 150,
                ease: 'Sine.easeIn',
                onComplete: () => {
                    // Swap visuals at midpoint
                    this.cardBack.setVisible(true);
                    this.cardFront.setVisible(false);
                    if (this.img) this.img.setVisible(false);
                    if (this.labelText) this.labelText.setVisible(false);

                    this.currentState = 'faceDown';

                    // Second half: scale X back to 1 (reveal back)
                    this.scene.tweens.add({
                        targets: this,
                        scaleX: 1,
                        duration: 150,
                        ease: 'Sine.easeOut',
                        onComplete: () => {
                            this.isFlipping = false;
                            resolve();
                        }
                    });
                }
            });
        });
    }

    animateMatch(): void {
        this.currentState = 'matched';
        this.disableInteractive();

        // Draw a green border to mark as matched
        this.cardFront.lineStyle(3, 0x50c878, 1);
        const hw = this.cardWidth / 2;
        const hh = this.cardHeight / 2;
        this.cardFront.strokeRoundedRect(-hw, -hh, this.cardWidth, this.cardHeight, 12);

        // Double bounce celebration
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 200,
            yoyo: true,
            repeat: 1,
            ease: 'Back.easeOut'
        });
    }

    animateIn(delay: number): void {
        this.setScale(0);
        this.setAlpha(0);
        this.scene.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 300,
            delay,
            ease: 'Back.easeOut'
        });
    }

    showFocus(): void {
        this.focusRing.setVisible(true);
    }

    hideFocus(): void {
        this.focusRing.setVisible(false);
    }

    getAccessibleLabel(): string {
        if (this.currentState === 'faceDown') {
            return 'Face-down card';
        }
        return this.label;
    }

    private drawCardBack(): void {
        this.cardBack.clear();
        const hw = this.cardWidth / 2;
        const hh = this.cardHeight / 2;
        const r = 12;

        // Card background
        this.cardBack.fillStyle(this.theme.primary, 1);
        this.cardBack.fillRoundedRect(-hw, -hh, this.cardWidth, this.cardHeight, r);
        this.cardBack.lineStyle(2, 0xffffff, 0.3);
        this.cardBack.strokeRoundedRect(-hw, -hh, this.cardWidth, this.cardHeight, r);

        // Diamond pattern on card back
        this.cardBack.fillStyle(0xffffff, 0.1);
        const cx = 0;
        const cy = 0;
        const dSize = Math.min(this.cardWidth, this.cardHeight) * 0.25;
        this.cardBack.fillPoints([
            new Phaser.Math.Vector2(cx, cy - dSize),
            new Phaser.Math.Vector2(cx + dSize, cy),
            new Phaser.Math.Vector2(cx, cy + dSize),
            new Phaser.Math.Vector2(cx - dSize, cy)
        ], true);
    }

    private drawCardFront(): void {
        this.cardFront.clear();
        const hw = this.cardWidth / 2;
        const hh = this.cardHeight / 2;
        const r = 12;

        this.cardFront.fillStyle(0xFFFFFF, 1);
        this.cardFront.fillRoundedRect(-hw, -hh, this.cardWidth, this.cardHeight, r);
        this.cardFront.lineStyle(2, this.theme.primary, 1);
        this.cardFront.strokeRoundedRect(-hw, -hh, this.cardWidth, this.cardHeight, r);
    }

    private drawFocusRing(): void {
        this.focusRing.clear();
        const hw = this.cardWidth / 2 + 4;
        const hh = this.cardHeight / 2 + 4;
        this.focusRing.lineStyle(3, 0xffcc00, 1);
        this.focusRing.strokeRoundedRect(-hw, -hh, hw * 2, hh * 2, 14);
    }

    private onPointerOver(): void {
        if (this.currentState === 'faceDown' && !this.isFlipping) {
            this.scene.input.setDefaultCursor('pointer');
            this.setScale(1.10);
        }
    }

    private onPointerOut(): void {
        this.scene.input.setDefaultCursor('default');
        if (this.currentState === 'faceDown' && !this.isFlipping) {
            this.setScale(1);
        }
    }
}
