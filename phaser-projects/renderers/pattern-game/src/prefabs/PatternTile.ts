import Phaser from 'phaser';
import { ThemeConfig } from '@edu-play/game-core';

export type TileShape = 'circle' | 'square' | 'triangle' | 'star';
export type TileSize = 'small' | 'medium' | 'large';

export interface TileSpec {
    shape: TileShape;
    fillColor: number;
    strokeColor?: number;
    size: TileSize;
}

export type PatternTileMode = 'display' | 'draggable';
export type PatternTileState = 'idle' | 'hover' | 'dragging' | 'placed' | 'snapback';

export interface PatternTileConfig {
    x: number;
    y: number;
    slotWidth: number;
    slotHeight: number;
    spec: TileSpec;
    tileKey: string;
    mode: PatternTileMode;
    theme: ThemeConfig;
    accessibleLabel?: string;
}

/**
 * PatternTile — a self-rendered shape tile used by the pattern game.
 *
 * One prefab class serves three visual roles:
 *   1. A static tile inside the displayed pattern row (`mode: 'display'`).
 *   2. A draggable answer tile living in the tray (`mode: 'draggable'`).
 *   3. The "placed" tile that sits inside a PatternGap once solved — the
 *      scene re-parents the draggable into the gap position.
 *
 * Rendering uses pure Phaser Graphics across three axes (shape / colour /
 * size). Near-zero asset dependency keeps this template Romanian-free and
 * cheap to fan out into many variants via config.
 *
 * Drag/drop primitives are copied inline from `categorize-game` per the
 * EDU-50 rule-of-three guidance — do not extract until a third consumer
 * lands.
 */
export default class PatternTile extends Phaser.GameObjects.Container {
    static readonly EVENTS = {
        PICKED_UP: 'pattern-tile-picked-up',
        PLACED: 'pattern-tile-placed',
        SNAP_BACK: 'pattern-tile-snap-back'
    } as const;

    readonly tileKey: string;
    readonly spec: TileSpec;
    readonly mode: PatternTileMode;

    homeX: number;
    homeY: number;

    private bg: Phaser.GameObjects.Graphics;
    private shapeGfx: Phaser.GameObjects.Graphics;
    private focusRing: Phaser.GameObjects.Graphics;
    private slotWidth: number;
    private slotHeight: number;
    private theme: ThemeConfig;
    private currentState: PatternTileState = 'idle';
    private accessibleLabel: string;

    constructor(scene: Phaser.Scene, config: PatternTileConfig) {
        super(scene, config.x, config.y);

        this.tileKey = config.tileKey;
        this.spec = config.spec;
        this.mode = config.mode;
        this.slotWidth = config.slotWidth;
        this.slotHeight = config.slotHeight;
        this.theme = config.theme;
        this.homeX = config.x;
        this.homeY = config.y;
        this.accessibleLabel = config.accessibleLabel ?? `tile ${config.tileKey}`;

        this.bg = scene.add.graphics();
        this.add(this.bg);

        this.shapeGfx = scene.add.graphics();
        this.add(this.shapeGfx);

        this.focusRing = scene.add.graphics();
        this.focusRing.setVisible(false);
        this.add(this.focusRing);

        this.drawBody();
        this.drawFocusRing();
        this.drawBackground('idle');

        this.setSize(config.slotWidth, config.slotHeight);

        if (config.mode === 'draggable') {
            this.setInteractive({ draggable: true, useHandCursor: true });
            this.on('pointerover', this.onPointerOver, this);
            this.on('pointerout', this.onPointerOut, this);
        }

        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    }

    getTileState(): PatternTileState {
        return this.currentState;
    }

    setTileState(state: PatternTileState): void {
        this.currentState = state;
        this.drawBackground(state);

        if (state === 'placed') {
            this.disableInteractive();
        }
    }

    getAccessibleLabel(): string {
        return this.accessibleLabel;
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

    /**
     * Wrong-drop reaction. Wobbles in place, then flies back to the tray
     * slot. No scoring penalty — kids under 8 learn faster with neutral
     * re-attempts than with red Xs.
     */
    animateSnapBack(): void {
        this.currentState = 'snapback';

        this.scene.tweens.add({
            targets: this,
            x: this.x + 8,
            duration: 50,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                this.scene.tweens.add({
                    targets: this,
                    x: this.homeX,
                    y: this.homeY,
                    duration: 250,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        this.setTileState('idle');
                        this.emit(PatternTile.EVENTS.SNAP_BACK, this);
                    }
                });
            }
        });
    }

    animatePlaced(targetX: number, targetY: number): void {
        this.scene.tweens.add({
            targets: this,
            x: targetX,
            y: targetY,
            duration: 180,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: this,
                    scaleX: 1.12,
                    scaleY: 1.12,
                    duration: 140,
                    yoyo: true,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        this.setTileState('placed');
                        this.emit(PatternTile.EVENTS.PLACED, this);
                    }
                });
            }
        });
    }

    showFocus(): void {
        this.focusRing.setVisible(true);
    }

    hideFocus(): void {
        this.focusRing.setVisible(false);
    }

    selectViaKeyboard(): void {
        this.setTileState('dragging');
        this.emit(PatternTile.EVENTS.PICKED_UP, this);
    }

    private onPointerOver(): void {
        if (this.currentState !== 'idle') return;
        this.scene.input.setDefaultCursor('grab');
        this.drawBackground('hover');
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.08,
            scaleY: 1.08,
            duration: 140,
            ease: 'Back.easeOut'
        });
    }

    private onPointerOut(): void {
        this.scene.input.setDefaultCursor('default');
        if (this.currentState !== 'idle') return;
        this.drawBackground('idle');
        this.scene.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            duration: 140
        });
    }

    private drawBackground(state: PatternTileState): void {
        this.bg.clear();

        // Display tiles inside the pattern row should feel "baked in" — no
        // card chrome. Draggables and gaps still need a clear card so kids
        // can target them.
        if (this.mode === 'display') {
            return;
        }

        const colors: Record<string, { fill: number; stroke: number }> = {
            idle:     { fill: 0xFFFFFF, stroke: 0xD0D5DD },
            hover:    { fill: 0xF0F4FF, stroke: this.theme.primary },
            dragging: { fill: 0xEEF4FF, stroke: this.theme.primary },
            placed:   { fill: 0xECFDF3, stroke: 0x50C878 },
            snapback: { fill: 0xFFFFFF, stroke: 0xD0D5DD }
        };

        const { fill, stroke } = colors[state] ?? colors['idle'];
        const strokeWidth = state === 'dragging' ? 3 : 2;
        const r = 12;
        const hw = this.slotWidth / 2;
        const hh = this.slotHeight / 2;

        this.bg.fillStyle(fill, 1);
        this.bg.fillRoundedRect(-hw, -hh, this.slotWidth, this.slotHeight, r);
        this.bg.lineStyle(strokeWidth, stroke, 1);
        this.bg.strokeRoundedRect(-hw, -hh, this.slotWidth, this.slotHeight, r);
    }

    private drawFocusRing(): void {
        this.focusRing.clear();
        const hw = this.slotWidth / 2 + 4;
        const hh = this.slotHeight / 2 + 4;
        this.focusRing.lineStyle(3, 0xFFD54F, 1);
        this.focusRing.strokeRoundedRect(-hw, -hh, hw * 2, hh * 2, 14);
    }

    private drawBody(): void {
        const { shape, fillColor } = this.spec;
        const strokeColor = this.spec.strokeColor ?? this.darken(fillColor, 0.6);
        const r = this.shapeRadius();
        const g = this.shapeGfx;

        g.clear();
        g.fillStyle(fillColor, 1);
        g.lineStyle(4, strokeColor, 1);

        switch (shape) {
            case 'circle':
                g.fillCircle(0, 0, r);
                g.strokeCircle(0, 0, r);
                break;
            case 'square':
                g.fillRoundedRect(-r, -r, r * 2, r * 2, r * 0.22);
                g.strokeRoundedRect(-r, -r, r * 2, r * 2, r * 0.22);
                break;
            case 'triangle': {
                const points = [
                    new Phaser.Math.Vector2(0, -r),
                    new Phaser.Math.Vector2(r * 0.95, r * 0.7),
                    new Phaser.Math.Vector2(-r * 0.95, r * 0.7)
                ];
                g.fillPoints(points, true);
                g.strokePoints(points, true);
                break;
            }
            case 'star': {
                const points = this.buildStarPoints(r);
                g.fillPoints(points, true);
                g.strokePoints(points, true);
                break;
            }
        }
    }

    private shapeRadius(): number {
        // Pattern recognition works best when "size" is a visible axis —
        // small tiles are ~55%, medium ~75%, large ~92% of the slot radius.
        // All three sizes stay inside the 64px minimum tap target because
        // the slot itself is always at least 96px.
        const base = Math.min(this.slotWidth, this.slotHeight) / 2 - 10;
        switch (this.spec.size) {
            case 'small':
                return Math.max(22, base * 0.55);
            case 'large':
                return Math.max(32, base * 0.92);
            case 'medium':
            default:
                return Math.max(28, base * 0.75);
        }
    }

    private buildStarPoints(r: number): Phaser.Math.Vector2[] {
        const points: Phaser.Math.Vector2[] = [];
        const outer = r;
        const inner = r * 0.45;
        const spikes = 5;
        const rot = -Math.PI / 2;
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outer : inner;
            const a = rot + (i * Math.PI) / spikes;
            points.push(new Phaser.Math.Vector2(Math.cos(a) * radius, Math.sin(a) * radius));
        }
        return points;
    }

    private darken(color: number, factor: number): number {
        const r = Math.floor(((color >> 16) & 0xff) * factor);
        const g = Math.floor(((color >> 8) & 0xff) * factor);
        const b = Math.floor((color & 0xff) * factor);
        return (r << 16) | (g << 8) | b;
    }
}
