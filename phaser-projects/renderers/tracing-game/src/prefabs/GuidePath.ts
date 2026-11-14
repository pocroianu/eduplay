import Phaser from 'phaser';
import { ThemeConfig } from '@edu-play/game-core';
import { Checkpoint } from '../utils/svgPathParser';

export interface GuidePathConfig {
    path: Phaser.Curves.Path;
    checkpoints: Checkpoint[];
    theme: ThemeConfig;
    lineWidth?: number;
}

export default class GuidePath extends Phaser.GameObjects.Container {
    private graphics: Phaser.GameObjects.Graphics;
    private startIndicator: Phaser.GameObjects.Arc;
    private pathData: Phaser.Curves.Path;
    private pathCheckpoints: Checkpoint[];
    private theme: ThemeConfig;
    private lineWidth: number;
    private pulseTween: Phaser.Tweens.Tween | null = null;

    constructor(scene: Phaser.Scene, config: GuidePathConfig) {
        super(scene, 0, 0);
        scene.add.existing(this);

        this.pathData = config.path;
        this.pathCheckpoints = config.checkpoints;
        this.theme = config.theme;
        this.lineWidth = config.lineWidth ?? 12;

        this.graphics = scene.add.graphics();
        this.add(this.graphics);
        this.drawDashedPath();

        const start = this.pathCheckpoints[0];
        this.startIndicator = scene.add.circle(start.x, start.y, 18, this.theme.secondary, 0.85);
        this.add(this.startIndicator);
        this.pulseStart();
    }

    private drawDashedPath(): void {
        const color = this.theme.secondary;
        this.graphics.lineStyle(this.lineWidth, color, 0.65);

        const points = this.pathData.getPoints(128);
        const dashLength = 12;
        const gapLength = 8;
        let drawing = true;
        let segmentRemaining = dashLength;

        if (points.length < 2) return;

        this.graphics.beginPath();
        this.graphics.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist === 0) continue;

            let consumed = 0;

            while (consumed < dist) {
                const step = Math.min(segmentRemaining, dist - consumed);
                const t = (consumed + step) / dist;
                const px = prev.x + dx * t;
                const py = prev.y + dy * t;

                if (drawing) {
                    this.graphics.lineTo(px, py);
                } else {
                    this.graphics.moveTo(px, py);
                }

                consumed += step;
                segmentRemaining -= step;

                if (segmentRemaining <= 0) {
                    drawing = !drawing;
                    segmentRemaining = drawing ? dashLength : gapLength;
                    if (drawing) {
                        this.graphics.strokePath();
                        this.graphics.beginPath();
                        this.graphics.moveTo(px, py);
                    }
                }
            }
        }

        if (drawing) {
            this.graphics.strokePath();
        }
    }

    private pulseStart(): void {
        this.pulseTween = this.scene.tweens.add({
            targets: this.startIndicator,
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0.5,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    hideStartIndicator(): void {
        if (this.pulseTween) {
            this.pulseTween.stop();
            this.pulseTween = null;
        }
        this.startIndicator.setVisible(false);
    }

    /**
     * Move the pulsing indicator to a specific checkpoint position.
     * Used to show where the user should press to resume tracing.
     */
    showIndicatorAt(x: number, y: number): void {
        this.startIndicator.setPosition(x, y);
        this.startIndicator.setVisible(true);
        if (!this.pulseTween || !this.pulseTween.isPlaying()) {
            this.pulseStart();
        }
    }

    getCheckpoints(): Checkpoint[] {
        return this.pathCheckpoints;
    }

    getPath(): Phaser.Curves.Path {
        return this.pathData;
    }

    animateIn(delay = 0): void {
        this.setAlpha(0);
        this.scene.tweens.add({
            targets: this,
            alpha: 1,
            duration: 300,
            delay,
            ease: 'Power2'
        });
    }

    animateOut(): Promise<void> {
        return new Promise(resolve => {
            this.scene.tweens.add({
                targets: this,
                alpha: 0,
                duration: 200,
                ease: 'Power2',
                onComplete: () => resolve()
            });
        });
    }

    showHintPulse(): void {
        this.scene.tweens.add({
            targets: this.graphics,
            alpha: 0.8,
            duration: 200,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });
    }

    destroy(fromScene?: boolean): void {
        if (this.pulseTween) {
            this.pulseTween.stop();
        }
        super.destroy(fromScene);
    }
}
