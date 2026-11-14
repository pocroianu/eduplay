import Phaser from 'phaser';
import { ThemeConfig } from '@edu-play/game-core';

export interface AudioPromptButtonConfig {
    x: number;
    y: number;
    radius: number;
    theme: ThemeConfig;
}

/**
 * AudioPromptButton — big, always-visible replay button.
 *
 * Pre-readers can't read a "repeat" label, so the affordance is purely
 * visual: a large round button with a speaker/play glyph that pulses at
 * rest so the child can find it. Tapping emits {@link PRESSED} — the
 * Level scene is responsible for re-playing the current round's prompt.
 *
 * Deliberately low-key in pop feedback so repeated taps stay calming.
 */
export default class AudioPromptButton extends Phaser.GameObjects.Container {
    static readonly EVENTS = {
        PRESSED: 'audio-prompt-pressed'
    } as const;

    private radius: number;
    private theme: ThemeConfig;
    private bodyGfx: Phaser.GameObjects.Graphics;
    private glyph: Phaser.GameObjects.Graphics;
    private pulseRing: Phaser.GameObjects.Graphics;
    private pulseTween: Phaser.Tweens.Tween | null = null;

    constructor(scene: Phaser.Scene, config: AudioPromptButtonConfig) {
        super(scene, config.x, config.y);
        this.radius = config.radius;
        this.theme = config.theme;

        this.pulseRing = scene.add.graphics();
        this.drawPulseRing();
        this.add(this.pulseRing);

        this.bodyGfx = scene.add.graphics();
        this.drawBody(false);
        this.add(this.bodyGfx);

        this.glyph = scene.add.graphics();
        this.drawSpeakerGlyph();
        this.add(this.glyph);

        const hit = new Phaser.Geom.Circle(0, 0, config.radius + 10);
        this.setSize(config.radius * 2, config.radius * 2);
        this.setInteractive(hit, Phaser.Geom.Circle.Contains, { useHandCursor: true } as any);

        this.on('pointerover', this.onPointerOver, this);
        this.on('pointerout', this.onPointerOut, this);
        this.on('pointerdown', this.onPointerDown, this);
        this.on('pointerup', this.onPointerUp, this);

        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    }

    pulse(): void {
        if (this.pulseTween) {
            return;
        }
        this.pulseRing.setAlpha(0.5);
        this.pulseRing.setScale(1);
        this.pulseTween = this.scene.tweens.add({
            targets: this.pulseRing,
            scaleX: 1.25,
            scaleY: 1.25,
            alpha: 0,
            duration: 900,
            ease: 'Sine.easeOut',
            repeat: -1
        });
    }

    stopPulse(): void {
        if (this.pulseTween) {
            this.pulseTween.stop();
            this.pulseTween = null;
        }
        this.pulseRing.setAlpha(0);
    }

    private onPointerOver(): void {
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.06,
            scaleY: 1.06,
            duration: 140,
            ease: 'Back.easeOut'
        });
    }

    private onPointerOut(): void {
        this.scene.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            duration: 140
        });
    }

    private onPointerDown(): void {
        this.drawBody(true);
        this.scene.tweens.add({
            targets: this,
            scaleX: 0.94,
            scaleY: 0.94,
            duration: 80
        });
    }

    private onPointerUp(): void {
        this.drawBody(false);
        this.scene.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            duration: 100
        });
        this.emit(AudioPromptButton.EVENTS.PRESSED);
    }

    private drawBody(pressed: boolean): void {
        const g = this.bodyGfx;
        g.clear();

        const fill = pressed ? this.theme.secondary : this.theme.primary;

        // Soft shadow for depth
        g.fillStyle(0x000000, 0.22);
        g.fillCircle(4, 8, this.radius);

        g.fillStyle(fill, 1);
        g.fillCircle(0, 0, this.radius);
        g.lineStyle(5, 0xFFFFFF, 1);
        g.strokeCircle(0, 0, this.radius);
    }

    private drawSpeakerGlyph(): void {
        const r = this.radius;
        const g = this.glyph;
        g.clear();
        g.fillStyle(0xFFFFFF, 1);

        // Speaker body — a trapezoid + box
        const bx = -r * 0.32;
        const by = -r * 0.28;
        const boxW = r * 0.25;
        const boxH = r * 0.56;

        g.fillRoundedRect(bx, by, boxW, boxH, 4);

        const coneLeft = bx + boxW;
        const conePoints = [
            new Phaser.Math.Vector2(coneLeft, by + 4),
            new Phaser.Math.Vector2(coneLeft + r * 0.3, by - r * 0.18),
            new Phaser.Math.Vector2(coneLeft + r * 0.3, by + boxH + r * 0.18),
            new Phaser.Math.Vector2(coneLeft, by + boxH - 4)
        ];
        g.fillPoints(conePoints, true);

        // Sound waves
        g.lineStyle(5, 0xFFFFFF, 1);
        const arcX = coneLeft + r * 0.38;
        const arcY = 0;
        for (let i = 1; i <= 2; i++) {
            const radius = r * 0.18 * i + r * 0.12;
            g.beginPath();
            g.arc(arcX, arcY, radius, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(40), false);
            g.strokePath();
        }
    }

    private drawPulseRing(): void {
        const g = this.pulseRing;
        g.clear();
        g.lineStyle(6, 0xFFFFFF, 0.8);
        g.strokeCircle(0, 0, this.radius + 6);
    }
}
