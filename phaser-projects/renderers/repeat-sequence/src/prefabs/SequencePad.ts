import Phaser from 'phaser';
import { ThemeConfig } from '@edu-play/game-core';

export type PadGlyph = 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'note' | 'pawprint' | 'none';

export interface SequencePadSpec {
    id: string;
    idleColor: number;
    litColor: number;
    frequency: number;
    glyph?: PadGlyph;
    accessibleLabel?: string;
}

export interface SequencePadConfig {
    x: number;
    y: number;
    size: number;
    spec: SequencePadSpec;
    theme: ThemeConfig;
}

/**
 * SequencePad — a single Simon-style pad.
 *
 * Renders a rounded rectangular pad in its idle colour. `flash()` briefly
 * swaps to the lit colour, plays its assigned tone, then fades back — this
 * is the unit of playback for both the scene demo and the kid's own taps.
 *
 * The tone is synthesised in-scene via the Web Audio context exposed on
 * `scene.sound.context` (see AudioManager.playGeneratedSfx for the same
 * pattern). Keeping tone synthesis local to the pad means a variant only has
 * to pick four frequencies to change the whole audio identity of a skin — no
 * per-variant audio files, no Romanian voice dependency.
 *
 * The pad listens to its own `pointerdown` and raises PAD_PRESSED. The scene
 * owns the state machine that decides what a press means (idle ignore,
 * playback ignore, correct-so-far advance, wrong-so-far end).
 */
export default class SequencePad extends Phaser.GameObjects.Container {
    static readonly EVENTS = {
        PAD_PRESSED: 'sequence-pad-pressed'
    } as const;

    readonly spec: SequencePadSpec;

    private bg: Phaser.GameObjects.Graphics;
    private glyphGfx: Phaser.GameObjects.Graphics;
    private focusRing: Phaser.GameObjects.Graphics;
    private accessibleLabel: string;
    private padSize: number;
    private theme: ThemeConfig;
    private lit = false;
    private enabled = false;
    private scaleTween?: Phaser.Tweens.Tween;

    constructor(scene: Phaser.Scene, config: SequencePadConfig) {
        super(scene, config.x, config.y);

        this.spec = config.spec;
        this.padSize = config.size;
        this.theme = config.theme;
        this.accessibleLabel = config.spec.accessibleLabel ?? `pad ${config.spec.id}`;

        this.bg = scene.add.graphics();
        this.add(this.bg);

        this.glyphGfx = scene.add.graphics();
        this.add(this.glyphGfx);

        this.focusRing = scene.add.graphics();
        this.focusRing.setVisible(false);
        this.add(this.focusRing);

        this.drawBackground();
        this.drawGlyph();
        this.drawFocusRing();

        this.setSize(config.size, config.size);
        this.setInteractive(
            new Phaser.Geom.Rectangle(-config.size / 2, -config.size / 2, config.size, config.size),
            Phaser.Geom.Rectangle.Contains
        );

        this.on('pointerdown', this.handlePress, this);
        this.on('pointerover', this.handlePointerOver, this);
        this.on('pointerout', this.handlePointerOut, this);

        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    }

    getAccessibleLabel(): string {
        return this.accessibleLabel;
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        this.input && (this.input.cursor = enabled ? 'pointer' : 'default');
    }

    isEnabled(): boolean {
        return this.enabled;
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

    /**
     * Fire a pad pulse: light up for `duration` ms, play its tone, then
     * fade back. Returns a promise that resolves when the pulse finishes
     * so the scene can sequence playback (await flash → wait gap → next).
     *
     * Plays the tone even when the pad isn't interactable so the scene can
     * drive demo playback without flipping enabled state.
     */
    flash(duration: number, options?: { playTone?: boolean; intensity?: number }): Promise<void> {
        const playTone = options?.playTone ?? true;
        const intensity = options?.intensity ?? 1;

        this.setLit(true);
        if (playTone) {
            this.playTone(Math.max(100, duration - 40));
        }

        if (this.scaleTween) {
            this.scaleTween.remove();
            this.scaleTween = undefined;
        }

        return new Promise((resolve) => {
            this.scaleTween = this.scene.tweens.add({
                targets: this,
                scaleX: 1 + 0.06 * intensity,
                scaleY: 1 + 0.06 * intensity,
                duration: duration * 0.4,
                yoyo: true,
                ease: 'Sine.easeOut'
            });

            this.scene.time.delayedCall(duration, () => {
                this.setLit(false);
                resolve();
            });
        });
    }

    /**
     * Called by the scene when the kid lands on a wrong pad. Soft wobble
     * + brief red-tinted halo — no harsh red X. We keep the pad's own
     * colour so kids can see which pad they pressed, but tint the halo so
     * they can feel "not that one".
     */
    animateWrong(): void {
        const halo = this.scene.add.graphics();
        const hw = this.padSize / 2 + 6;
        halo.lineStyle(4, 0xE87D7D, 0.9);
        halo.strokeRoundedRect(this.x - hw, this.y - hw, hw * 2, hw * 2, 22);
        this.scene.tweens.add({
            targets: halo,
            alpha: 0,
            duration: 520,
            ease: 'Sine.easeOut',
            onComplete: () => halo.destroy()
        });

        this.scene.tweens.add({
            targets: this,
            x: this.x + 6,
            duration: 55,
            yoyo: true,
            repeat: 2
        });
    }

    showFocus(): void {
        this.focusRing.setVisible(true);
    }

    hideFocus(): void {
        this.focusRing.setVisible(false);
    }

    private handlePress(): void {
        if (!this.enabled) return;
        this.emit(SequencePad.EVENTS.PAD_PRESSED, this);
    }

    private handlePointerOver(): void {
        if (!this.enabled) return;
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.04,
            scaleY: 1.04,
            duration: 120,
            ease: 'Sine.easeOut'
        });
    }

    private handlePointerOut(): void {
        if (!this.enabled) return;
        this.scene.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            duration: 120
        });
    }

    private setLit(lit: boolean): void {
        if (this.lit === lit) return;
        this.lit = lit;
        this.drawBackground();
        this.drawGlyph();
    }

    private drawBackground(): void {
        const hw = this.padSize / 2;
        const r = 18;
        const color = this.lit ? this.spec.litColor : this.spec.idleColor;
        const strokeColor = this.lit ? 0xFFFFFF : this.darken(this.spec.idleColor, 0.55);
        const strokeWidth = this.lit ? 5 : 3;

        this.bg.clear();
        this.bg.fillStyle(color, 1);
        this.bg.fillRoundedRect(-hw, -hw, this.padSize, this.padSize, r);
        this.bg.lineStyle(strokeWidth, strokeColor, 1);
        this.bg.strokeRoundedRect(-hw, -hw, this.padSize, this.padSize, r);

        // When lit, add an inner glow ring so the "on" state reads even on
        // high-ambient-light screens where fill alone is hard to see.
        if (this.lit) {
            const inner = hw - 10;
            this.bg.lineStyle(3, 0xFFFFFF, 0.55);
            this.bg.strokeRoundedRect(-inner, -inner, inner * 2, inner * 2, r - 6);
        }
    }

    private drawGlyph(): void {
        const glyph = this.spec.glyph ?? 'none';
        if (glyph === 'none') {
            this.glyphGfx.clear();
            return;
        }

        const g = this.glyphGfx;
        const r = this.padSize * 0.22;
        const fill = this.lit ? 0xFFFFFF : 0xFFFFFF;
        const alpha = this.lit ? 0.95 : 0.85;
        const strokeColor = this.darken(this.spec.idleColor, 0.35);

        g.clear();
        g.fillStyle(fill, alpha);
        g.lineStyle(3, strokeColor, 0.75);

        switch (glyph) {
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
            case 'diamond': {
                const points = [
                    new Phaser.Math.Vector2(0, -r),
                    new Phaser.Math.Vector2(r, 0),
                    new Phaser.Math.Vector2(0, r),
                    new Phaser.Math.Vector2(-r, 0)
                ];
                g.fillPoints(points, true);
                g.strokePoints(points, true);
                break;
            }
            case 'star': {
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
                g.fillPoints(points, true);
                g.strokePoints(points, true);
                break;
            }
            case 'note': {
                // Stylised eighth-note — stem + round head. Reads as "music".
                g.fillEllipse(-r * 0.15, r * 0.4, r * 0.9, r * 0.65);
                g.lineStyle(5, fill, alpha);
                g.beginPath();
                g.moveTo(r * 0.3, r * 0.4);
                g.lineTo(r * 0.3, -r * 0.9);
                g.lineTo(r * 0.9, -r * 0.6);
                g.strokePath();
                break;
            }
            case 'pawprint': {
                // Simple 4-pad + heel dot glyph.
                const pad = r * 0.28;
                g.fillCircle(-r * 0.55, -r * 0.15, pad);
                g.fillCircle(-r * 0.2, -r * 0.55, pad);
                g.fillCircle(r * 0.2, -r * 0.55, pad);
                g.fillCircle(r * 0.55, -r * 0.15, pad);
                g.fillEllipse(0, r * 0.35, r * 1.05, r * 0.8);
                break;
            }
        }
    }

    private drawFocusRing(): void {
        const hw = this.padSize / 2 + 6;
        this.focusRing.clear();
        this.focusRing.lineStyle(3, 0xFFD54F, 1);
        this.focusRing.strokeRoundedRect(-hw, -hw, hw * 2, hw * 2, 22);
    }

    /**
     * Fire a short synthesised tone at the pad's assigned frequency. We use
     * `scene.sound.context` (Phaser's AudioContext) directly — the same
     * fallback channel AudioManager uses for generated SFX. This stays local
     * to the pad to keep template-specific tonal identity out of the shared
     * AudioManager surface.
     */
    private playTone(durationMs: number): void {
        const ctx = (this.scene.sound as any).context as AudioContext | undefined;
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(this.spec.frequency, now);

            // Gentle ADSR envelope: short attack, plateau, long release so
            // back-to-back pad presses don't click.
            const peak = 0.22;
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(peak, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                now + Math.max(0.1, durationMs / 1000)
            );

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + Math.max(0.12, durationMs / 1000 + 0.04));
        } catch (err) {
            console.warn('[SequencePad] Failed to play tone:', err);
        }
    }

    private darken(color: number, factor: number): number {
        const r = Math.floor(((color >> 16) & 0xff) * factor);
        const g = Math.floor(((color >> 8) & 0xff) * factor);
        const b = Math.floor((color & 0xff) * factor);
        return (r << 16) | (g << 8) | b;
    }
}
