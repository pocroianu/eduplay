import Phaser from 'phaser';
import { ThemeConfig } from '@edu-play/game-core';

export type CountableShape = 'circle' | 'star' | 'triangle' | 'square';

export interface CountableObjectConfig {
    x: number;
    y: number;
    radius: number;
    shape: CountableShape;
    fillColor: number;
    strokeColor: number;
    theme: ThemeConfig;
    accessibleLabel: string;
}

/**
 * CountableObject — a tap-to-pop prefab used in the counting game.
 *
 * Each object is a large, kid-friendly shape drawn with Phaser Graphics
 * (no sprite dependency). Tapping once "pops" the object with a scale+audio
 * feedback and flags it as counted. A checkmark badge is revealed so the
 * child can see which objects they have already counted.
 *
 * Shapes are intentionally simple (circle, star, triangle, square) so that a
 * single prefab can back many themes without a custom sprite per kind. Real
 * sprite art can be layered in later by passing a textureKey through config.
 */
export default class CountableObject extends Phaser.GameObjects.Container {
    static readonly EVENTS = {
        COUNTED: 'countable-counted',
        UNCOUNTED: 'countable-uncounted'
    } as const;

    private shape: CountableShape;
    private radius: number;
    private fillColor: number;
    private strokeColor: number;
    private bodyGfx: Phaser.GameObjects.Graphics;
    private badge: Phaser.GameObjects.Graphics;
    private focusRing: Phaser.GameObjects.Graphics;
    private counted = false;
    private isPopping = false;

    constructor(scene: Phaser.Scene, config: CountableObjectConfig) {
        super(scene, config.x, config.y);

        this.shape = config.shape;
        this.radius = config.radius;
        this.fillColor = config.fillColor;
        this.strokeColor = config.strokeColor;

        this.bodyGfx = scene.add.graphics();
        this.drawBody();
        this.add(this.bodyGfx);

        this.badge = scene.add.graphics();
        this.drawBadge();
        this.badge.setVisible(false);
        this.add(this.badge);

        this.focusRing = scene.add.graphics();
        this.drawFocusRing();
        this.focusRing.setVisible(false);
        this.add(this.focusRing);

        const hit = new Phaser.Geom.Circle(0, 0, config.radius + 6);
        this.setSize(config.radius * 2, config.radius * 2);
        this.setInteractive(hit, Phaser.Geom.Circle.Contains, { useHandCursor: true } as any);

        this.setData('accessibleLabel', config.accessibleLabel);

        this.on('pointerover', this.onPointerOver, this);
        this.on('pointerout', this.onPointerOut, this);

        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    }

    isCounted(): boolean {
        return this.counted;
    }

    /**
     * Play the tap-to-pop animation and flip internal state to counted.
     * Idempotent — returns without effect if already counted.
     */
    pop(): Promise<void> {
        if (this.counted || this.isPopping) {
            return Promise.resolve();
        }

        this.isPopping = true;
        this.counted = true;

        return new Promise((resolve) => {
            this.scene.tweens.add({
                targets: this,
                scaleX: 1.35,
                scaleY: 1.35,
                duration: 140,
                ease: 'Back.easeOut',
                yoyo: true,
                onYoyo: () => {
                    this.badge.setVisible(true);
                    this.badge.setScale(0);
                    this.scene.tweens.add({
                        targets: this.badge,
                        scaleX: 1,
                        scaleY: 1,
                        duration: 160,
                        ease: 'Back.easeOut'
                    });
                },
                onComplete: () => {
                    this.isPopping = false;
                    this.emit(CountableObject.EVENTS.COUNTED, this);
                    resolve();
                }
            });
        });
    }

    reset(): void {
        this.counted = false;
        this.isPopping = false;
        this.badge.setVisible(false);
        this.setScale(1);
    }

    animateIn(delay: number): void {
        this.setScale(0);
        this.setAlpha(0);
        this.scene.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 320,
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

    private onPointerOver(): void {
        if (this.counted || this.isPopping) return;
        this.scene.input.setDefaultCursor('pointer');
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
        if (this.counted || this.isPopping) return;
        this.scene.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            duration: 140
        });
    }

    private drawBody(): void {
        const r = this.radius;
        const g = this.bodyGfx;
        g.clear();

        g.fillStyle(this.fillColor, 1);
        g.lineStyle(4, this.strokeColor, 1);

        switch (this.shape) {
            case 'circle':
                g.fillCircle(0, 0, r);
                g.strokeCircle(0, 0, r);
                break;
            case 'star': {
                const points = this.buildStarPoints(r);
                g.fillPoints(points, true);
                g.strokePoints(points, true);
                break;
            }
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
            case 'square':
                g.fillRoundedRect(-r, -r, r * 2, r * 2, r * 0.22);
                g.strokeRoundedRect(-r, -r, r * 2, r * 2, r * 0.22);
                break;
        }
    }

    private drawBadge(): void {
        const r = this.radius;
        const bx = r * 0.7;
        const by = -r * 0.7;
        const br = Math.max(16, r * 0.36);
        const g = this.badge;
        g.clear();

        // Green check badge — celebrates each count without being punishing
        g.fillStyle(0x4CAF50, 1);
        g.fillCircle(bx, by, br);
        g.lineStyle(3, 0xFFFFFF, 1);
        g.strokeCircle(bx, by, br);

        // Checkmark strokes — drawn as two lines inside the circle
        g.lineStyle(Math.max(3, br * 0.2), 0xFFFFFF, 1);
        g.beginPath();
        g.moveTo(bx - br * 0.45, by);
        g.lineTo(bx - br * 0.1, by + br * 0.35);
        g.lineTo(bx + br * 0.45, by - br * 0.3);
        g.strokePath();
    }

    private drawFocusRing(): void {
        const r = this.radius + 8;
        const g = this.focusRing;
        g.clear();
        g.lineStyle(4, 0xFFD54F, 1);
        g.strokeCircle(0, 0, r);
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
}
