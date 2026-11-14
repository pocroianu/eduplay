import Phaser from 'phaser';
import { ThemeConfig } from '@edu-play/game-core';
import { Checkpoint } from '../utils/svgPathParser';

export interface TraceTrailConfig {
    path: Phaser.Curves.Path;
    checkpoints: Checkpoint[];
    theme: ThemeConfig;
    lineWidth?: number;
}

export default class TraceTrail extends Phaser.GameObjects.Container {
    private graphics: Phaser.GameObjects.Graphics;
    private trailPath: Phaser.Curves.Path;
    private trailCheckpoints: Checkpoint[];
    private theme: ThemeConfig;
    private lineWidth: number;
    private claimedCount = 0;

    /**
     * The current t-value (0..1) along the path that the trail is drawn to.
     * This allows smooth drawing between checkpoints, not just at them.
     */
    private currentT = 0;

    /**
     * Pre-computed sample points along the full path for fast drawing.
     * Generated once at construction time.
     */
    private fullPathPoints: Phaser.Math.Vector2[] = [];
    private static readonly SAMPLE_COUNT = 200;

    constructor(scene: Phaser.Scene, config: TraceTrailConfig) {
        super(scene, 0, 0);
        scene.add.existing(this);

        this.trailPath = config.path;
        this.trailCheckpoints = config.checkpoints;
        this.theme = config.theme;
        this.lineWidth = config.lineWidth ?? 10;

        this.graphics = scene.add.graphics();
        this.add(this.graphics);

        // Pre-compute all sample points along the path for fast redraws
        this.precomputePathPoints();
    }

    private precomputePathPoints(): void {
        this.fullPathPoints = [];
        for (let i = 0; i <= TraceTrail.SAMPLE_COUNT; i++) {
            const t = i / TraceTrail.SAMPLE_COUNT;
            this.fullPathPoints.push(this.trailPath.getPoint(t));
        }
    }

    claimCheckpoint(index: number): void {
        this.claimedCount = index + 1;
        const total = this.trailCheckpoints.length;
        const checkpointT = total > 1 ? index / (total - 1) : 0;
        // Snap currentT forward to at least the checkpoint position
        if (checkpointT > this.currentT) {
            this.currentT = checkpointT;
        }
        this.redraw();
    }

    /**
     * Draw the trail up to an arbitrary t-value along the path.
     * Called continuously during pointer movement for smooth visual feedback.
     * The t-value is clamped to not exceed the next unclaimed checkpoint's position,
     * so the trail only advances where the user has actually traced.
     */
    drawToProgress(t: number): void {
        this.currentT = Math.max(this.currentT, t);
        this.redraw();
    }

    /**
     * Get the current t-value the trail is drawn to.
     */
    getCurrentT(): number {
        return this.currentT;
    }

    private redraw(): void {
        this.graphics.clear();

        if (this.currentT <= 0) return;

        const color = this.theme.primary;
        this.graphics.lineStyle(this.lineWidth, color, 1);

        // Use pre-computed points up to the current t-value
        const endIndex = Math.ceil(this.currentT * TraceTrail.SAMPLE_COUNT);
        const clampedEnd = Math.min(endIndex, this.fullPathPoints.length - 1);

        if (clampedEnd < 1) return;

        this.graphics.beginPath();
        this.graphics.moveTo(this.fullPathPoints[0].x, this.fullPathPoints[0].y);
        for (let i = 1; i <= clampedEnd; i++) {
            this.graphics.lineTo(this.fullPathPoints[i].x, this.fullPathPoints[i].y);
        }
        this.graphics.strokePath();
    }

    getClaimedCount(): number {
        return this.claimedCount;
    }

    isComplete(): boolean {
        return this.claimedCount >= this.trailCheckpoints.length;
    }

    animateIn(delay = 0): void {
        this.setAlpha(0);
        this.scene.tweens.add({
            targets: this,
            alpha: 1,
            duration: 200,
            delay,
            ease: 'Power2'
        });
    }
}
