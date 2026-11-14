import Phaser from 'phaser';
import { ThemeConfig } from '@edu-play/game-core';

export interface TracingParticlesConfig {
    theme: ThemeConfig;
}

export default class TracingParticles extends Phaser.GameObjects.Container {
    private particleTexture: string;
    private theme: ThemeConfig;

    /**
     * A continuously-emitting particle source that follows the finger
     * during tracing, providing a sparkle trail effect.
     */
    private trailEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

    constructor(scene: Phaser.Scene, config: TracingParticlesConfig) {
        super(scene, 0, 0);
        scene.add.existing(this);

        this.theme = config.theme;
        this.particleTexture = this.createParticleTexture();
    }

    private createParticleTexture(): string {
        const key = 'tracing-particle';
        if (this.scene.textures.exists(key)) return key;

        const size = 12;
        const canvas = this.scene.textures.createCanvas(key, size, size);
        if (!canvas) return key;

        const ctx = canvas.getContext();
        const colorHex = '#' + Phaser.Display.Color.ComponentToHex(this.theme.secondary >> 16 & 0xFF)
            + Phaser.Display.Color.ComponentToHex(this.theme.secondary >> 8 & 0xFF)
            + Phaser.Display.Color.ComponentToHex(this.theme.secondary & 0xFF);

        ctx.fillStyle = colorHex;
        ctx.beginPath();
        const cx = size / 2;
        const cy = size / 2;
        const outerR = size / 2;
        const innerR = size / 5;
        const spikes = 4;

        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (Math.PI * i) / spikes - Math.PI / 2;
            const px = cx + Math.cos(angle) * r;
            const py = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        canvas.refresh();

        return key;
    }

    burstAtCheckpoint(x: number, y: number): void {
        this.createBurst(x, y, 5, 800);
    }

    burstAtStrokeComplete(x: number, y: number): void {
        this.createBurst(x, y, 12, 1000);
    }

    burstAtItemComplete(x: number, y: number): void {
        this.createBurst(x, y, 25, 1200);
    }

    /**
     * Start continuous sparkle trail particles that follow the tracing finger.
     * Creates a gentle stream of tiny particles for constant visual feedback
     * while the child is actively dragging.
     */
    startTrail(x: number, y: number): void {
        if (!this.scene || !this.scene.add) return;

        // Reuse existing emitter if already active
        if (this.trailEmitter) {
            this.trailEmitter.setPosition(x, y);
            if (!this.trailEmitter.emitting) {
                this.trailEmitter.start();
            }
            return;
        }

        this.trailEmitter = this.scene.add.particles(x, y, this.particleTexture, {
            speed: { min: 10, max: 50 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.7, end: 0 },
            lifespan: 400,
            frequency: 40,
            quantity: 1,
            rotate: { min: 0, max: 360 }
        });
    }

    /**
     * Update the position of the continuous trail emitter to follow the finger.
     */
    updateTrailPosition(x: number, y: number): void {
        if (this.trailEmitter) {
            this.trailEmitter.setPosition(x, y);
        }
    }

    /**
     * Stop the continuous trail emitter (when the finger lifts or tracing pauses).
     */
    stopTrail(): void {
        if (this.trailEmitter) {
            this.trailEmitter.stop();
        }
    }

    /**
     * Destroy the trail emitter entirely (when switching strokes or items).
     */
    destroyTrail(): void {
        if (this.trailEmitter) {
            this.trailEmitter.destroy();
            this.trailEmitter = null;
        }
    }

    private createBurst(x: number, y: number, quantity: number, lifespan: number): void {
        if (!this.scene || !this.scene.add) return;

        const emitter = this.scene.add.particles(x, y, this.particleTexture, {
            speed: { min: 30, max: 120 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.8, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan,
            quantity,
            emitting: false,
            rotate: { min: 0, max: 360 }
        });

        emitter.explode(quantity);

        this.scene.time.delayedCall(lifespan + 100, () => {
            emitter.destroy();
        });
    }

    destroy(fromScene?: boolean): void {
        this.destroyTrail();
        super.destroy(fromScene);
    }
}
