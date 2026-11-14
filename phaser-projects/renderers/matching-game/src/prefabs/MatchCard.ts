import Phaser from 'phaser';
import { ThemeConfig } from '@edu-play/game-core';

export type MatchCardState = 'idle' | 'selected' | 'matched' | 'wrong';

export interface MatchCardConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    imageKey: string;
    pairId: string;
    theme: ThemeConfig;
}

export default class MatchCard extends Phaser.GameObjects.Container {
    static readonly EVENTS = {
        SELECTED: 'matchcard-selected'
    } as const;

    readonly pairId: string;
    private bg: Phaser.GameObjects.Graphics;
    private img: Phaser.GameObjects.Image;
    private cardWidth: number;
    private cardHeight: number;
    private theme: ThemeConfig;
    private currentState: MatchCardState = 'idle';

    constructor(scene: Phaser.Scene, config: MatchCardConfig) {
        super(scene, config.x, config.y);

        this.pairId = config.pairId;
        this.cardWidth = config.width;
        this.cardHeight = config.height;
        this.theme = config.theme;

        this.bg = scene.add.graphics();
        this.img = scene.add.image(0, 0, config.imageKey);
        const maxW = config.width * 0.75;
        const maxH = config.height * 0.75;
        const naturalW = this.img.width;
        const naturalH = this.img.height;
        const scale = Math.min(maxW / naturalW, maxH / naturalH);
        this.img.setDisplaySize(naturalW * scale, naturalH * scale);

        this.add([this.bg, this.img]);
        this.drawBackground('idle');

        this.setSize(config.width, config.height);
        this.setInteractive({ useHandCursor: true });
        this.on('pointerdown', this.onPointerDown, this);
        this.on('pointerover', this.onPointerOver, this);
        this.on('pointerout', this.onPointerOut, this);

        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    }

    getState(): MatchCardState {
        return this.currentState;
    }

    setCardState(state: MatchCardState): void {
        this.currentState = state;
        this.drawBackground(state);

        if (state === 'matched') {
            this.scene.tweens.add({
                targets: this,
                scaleX: 1.15,
                scaleY: 1.15,
                duration: 150,
                yoyo: true,
                ease: 'Back.easeOut',
                onComplete: () => {
                    this.setAlpha(0.7);
                    this.disableInteractive();
                }
            });
        } else if (state === 'wrong') {
            this.scene.tweens.add({
                targets: this,
                x: this.x + 6,
                duration: 40,
                yoyo: true,
                repeat: 3,
                onComplete: () => {
                    this.x = Math.round(this.x);
                    this.setCardState('idle');
                }
            });
        }
    }

    private drawBackground(state: MatchCardState): void {
        this.bg.clear();

        const colors: Record<MatchCardState, { fill: number; stroke: number }> = {
            idle:     { fill: 0xFFFFFF, stroke: 0xD0D5DD },
            selected: { fill: 0xEEF4FF, stroke: this.theme.primary },
            matched:  { fill: 0xECFDF3, stroke: 0x50c878 },
            wrong:    { fill: 0xFEF3F2, stroke: 0xe05555 }
        };

        const { fill, stroke } = colors[state];
        const strokeWidth = state === 'selected' ? 3 : 2;
        const r = 10;
        const hw = this.cardWidth / 2;
        const hh = this.cardHeight / 2;

        this.bg.fillStyle(fill, 1);
        this.bg.fillRoundedRect(-hw, -hh, this.cardWidth, this.cardHeight, r);
        this.bg.lineStyle(strokeWidth, stroke, 1);
        this.bg.strokeRoundedRect(-hw, -hh, this.cardWidth, this.cardHeight, r);

        if (state === 'selected') {
            this.bg.lineStyle(1, stroke, 0.3);
            this.bg.strokeRoundedRect(-hw + 4, -hh + 4, this.cardWidth - 8, this.cardHeight - 8, r - 2);
        }
    }

    private onPointerDown(): void {
        if (this.currentState === 'matched') return;
        this.emit(MatchCard.EVENTS.SELECTED, this);
    }

    private onPointerOver(): void {
        if (this.currentState === 'idle') {
            this.scene.input.setDefaultCursor('pointer');
            this.setScale(1.10);
        }
    }

    private onPointerOut(): void {
        this.scene.input.setDefaultCursor('default');
        if (this.currentState !== 'selected') {
            this.setScale(1);
        }
    }
}
