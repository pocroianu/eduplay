import Phaser from 'phaser';
import { ThemeConfig, GAME_FONT } from '@edu-play/game-core';
import { MatchCardState } from './MatchCard';

export interface WordCardConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    pairId: string;
    theme: ThemeConfig;
}

export default class WordCard extends Phaser.GameObjects.Container {
    static readonly EVENTS = {
        SELECTED: 'wordcard-selected'
    } as const;

    readonly pairId: string;
    private bg: Phaser.GameObjects.Graphics;
    private label: Phaser.GameObjects.Text;
    private cardWidth: number;
    private cardHeight: number;
    private theme: ThemeConfig;
    private currentState: MatchCardState = 'idle';

    constructor(scene: Phaser.Scene, config: WordCardConfig) {
        super(scene, config.x, config.y);

        this.pairId = config.pairId;
        this.cardWidth = config.width;
        this.cardHeight = config.height;
        this.theme = config.theme;

        this.bg = scene.add.graphics();
        this.label = scene.add.text(0, 0, config.label, {
            fontFamily: GAME_FONT,
            fontSize: `${Math.round(config.height * 0.3)}px`,
            color: '#1F2937',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5, 0.5);

        this.add([this.bg, this.label]);
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

        const labelColors: Record<MatchCardState, string> = {
            idle:     '#1F2937',
            selected: '#1a56db',
            matched:  '#166534',
            wrong:    '#dc2626'
        };
        this.label.setColor(labelColors[state]);

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
    }

    private onPointerDown(): void {
        if (this.currentState === 'matched') return;
        this.emit(WordCard.EVENTS.SELECTED, this);
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
