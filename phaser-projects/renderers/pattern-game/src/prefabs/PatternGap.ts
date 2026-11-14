import Phaser from 'phaser';
import { ThemeConfig } from '@edu-play/game-core';

export interface PatternGapConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    expectedTileKey: string;
    index: number;
    theme: ThemeConfig;
}

/**
 * PatternGap — a single-slot drop target inside the pattern row.
 *
 * Each gap expects a specific tile key (e.g. "A"). The scene matches on
 * `expectedTileKey` to decide correct vs. wrong drop. Draws a dashed
 * placeholder so kids visually register "something is missing here". Becomes
 * solid once filled.
 *
 * Inline copy of categorize-game's DropZone pattern; deferred extraction per
 * the EDU-50 rule-of-three guidance.
 */
export default class PatternGap extends Phaser.GameObjects.Container {
    readonly expectedTileKey: string;
    readonly index: number;

    private bg: Phaser.GameObjects.Graphics;
    private focusRing: Phaser.GameObjects.Graphics;
    private hitZone: Phaser.GameObjects.Zone;
    private gapWidth: number;
    private gapHeight: number;
    private theme: ThemeConfig;
    private filled = false;
    private isHighlighted = false;

    constructor(scene: Phaser.Scene, config: PatternGapConfig) {
        super(scene, config.x, config.y);

        this.expectedTileKey = config.expectedTileKey;
        this.index = config.index;
        this.gapWidth = config.width;
        this.gapHeight = config.height;
        this.theme = config.theme;

        this.bg = scene.add.graphics();
        this.add(this.bg);

        this.focusRing = scene.add.graphics();
        this.focusRing.setVisible(false);
        this.add(this.focusRing);
        this.drawFocusRing();

        this.drawBackground();

        this.hitZone = scene.add.zone(config.x, config.y, config.width, config.height);
        this.hitZone.setRectangleDropZone(config.width, config.height);
        this.hitZone.setData('expectedTileKey', config.expectedTileKey);
        this.hitZone.setData('patternGap', this);

        this.setSize(config.width, config.height);

        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    }

    getHitZone(): Phaser.GameObjects.Zone {
        return this.hitZone;
    }

    isFilled(): boolean {
        return this.filled;
    }

    setFilled(filled: boolean): void {
        this.filled = filled;
        this.drawBackground();
    }

    highlight(): void {
        if (this.isHighlighted) return;
        this.isHighlighted = true;
        this.drawBackground();
    }

    unhighlight(): void {
        if (!this.isHighlighted) return;
        this.isHighlighted = false;
        this.drawBackground();
    }

    showFocus(): void {
        this.focusRing.setVisible(true);
    }

    hideFocus(): void {
        this.focusRing.setVisible(false);
    }

    getAccessibleLabel(): string {
        return `gap ${this.index + 1}`;
    }

    /**
     * Tearing down the hit zone is important on scene shutdown — an
     * orphaned Phaser.Zone keeps the drag plugin holding a reference and
     * throws if the scene is reused by Play Again.
     */
    destroyGap(): void {
        this.hitZone.destroy();
        this.destroy();
    }

    private drawBackground(): void {
        this.bg.clear();

        const hw = this.gapWidth / 2;
        const hh = this.gapHeight / 2;
        const r = 12;

        if (this.filled) {
            // Once a tile lives here, drop chrome should disappear so the
            // pattern reads continuously.
            return;
        }

        // Hollow dashed card so the missing-slot cue is obvious to 4-8yos.
        const fillAlpha = this.isHighlighted ? 0.18 : 0.08;
        const strokeAlpha = this.isHighlighted ? 1 : 0.55;
        const strokeWidth = this.isHighlighted ? 3 : 2;

        this.bg.fillStyle(this.theme.primary, fillAlpha);
        this.bg.fillRoundedRect(-hw, -hh, this.gapWidth, this.gapHeight, r);

        // Approximate a dashed stroke with a sequence of short segments
        // along the perimeter. Phaser's Graphics API doesn't support
        // native dashed strokes but this reads as "open slot" to kids.
        this.bg.lineStyle(strokeWidth, this.theme.primary, strokeAlpha);
        this.strokeDashedRoundedRect(-hw, -hh, this.gapWidth, this.gapHeight, r, 10, 6);

        // "?" hint mark in the middle so pre-readers still pick up the
        // "something goes here" signal.
        this.bg.lineStyle(4, this.theme.primary, strokeAlpha);
        const s = Math.min(this.gapWidth, this.gapHeight) * 0.12;
        this.bg.beginPath();
        this.bg.arc(0, -s * 0.6, s, Math.PI, 0, false);
        this.bg.strokePath();
        this.bg.beginPath();
        this.bg.moveTo(s, -s * 0.6);
        this.bg.lineTo(0, s * 0.2);
        this.bg.strokePath();
        this.bg.fillStyle(this.theme.primary, strokeAlpha);
        this.bg.fillCircle(0, s * 0.8, 3);
    }

    private strokeDashedRoundedRect(
        x: number,
        y: number,
        w: number,
        h: number,
        radius: number,
        dash: number,
        gap: number
    ): void {
        const segments: Array<[number, number, number, number]> = [
            [x + radius, y, x + w - radius, y],
            [x + w, y + radius, x + w, y + h - radius],
            [x + w - radius, y + h, x + radius, y + h],
            [x, y + h - radius, x, y + radius]
        ];
        for (const [x1, y1, x2, y2] of segments) {
            this.strokeDashedLine(x1, y1, x2, y2, dash, gap);
        }
    }

    private strokeDashedLine(x1: number, y1: number, x2: number, y2: number, dash: number, gap: number): void {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len === 0) return;
        const ux = dx / len;
        const uy = dy / len;
        let travelled = 0;
        while (travelled < len) {
            const segEnd = Math.min(len, travelled + dash);
            this.bg.beginPath();
            this.bg.moveTo(x1 + ux * travelled, y1 + uy * travelled);
            this.bg.lineTo(x1 + ux * segEnd, y1 + uy * segEnd);
            this.bg.strokePath();
            travelled = segEnd + gap;
        }
    }

    private drawFocusRing(): void {
        this.focusRing.clear();
        const hw = this.gapWidth / 2 + 4;
        const hh = this.gapHeight / 2 + 4;
        this.focusRing.lineStyle(3, 0xFFD54F, 1);
        this.focusRing.strokeRoundedRect(-hw, -hh, hw * 2, hh * 2, 14);
    }
}
