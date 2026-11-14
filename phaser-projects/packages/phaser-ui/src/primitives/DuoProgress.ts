import Phaser from 'phaser';
import { ink, tone, type ToneName } from '../tokens/colors';
import { duration } from '../tokens/motion';
import { fontStack, typeScale } from '../tokens/type';

/**
 * DuoProgress — Phaser mirror of `kit/DuoProgress.tsx` (bar variant).
 *
 * The ring variant from the React kit is intentionally omitted here; game HUDs
 * almost exclusively use the linear bar. If a future template needs the ring,
 * add a `DuoProgressRing` sibling.
 */

export interface DuoProgressConfig {
  x: number;
  y: number;
  width: number;
  height?: number;
  /** 0..100 */
  value?: number;
  tone?: ToneName;
  showPercent?: boolean;
}

export class DuoProgress extends Phaser.GameObjects.Container {
  private readonly trackGfx: Phaser.GameObjects.Graphics;
  private readonly fillGfx: Phaser.GameObjects.Graphics;
  private readonly percentText: Phaser.GameObjects.Text | null;
  private readonly barWidth: number;
  private readonly barHeight: number;
  private readonly toneName: ToneName;
  private currentValue: number;
  private activeTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, config: DuoProgressConfig) {
    super(scene, config.x, config.y);

    this.barWidth = config.width;
    this.barHeight = config.height ?? 14;
    this.toneName = config.tone ?? 'green';
    this.currentValue = clamp(config.value ?? 0, 0, 100);

    this.trackGfx = scene.add.graphics();
    this.fillGfx = scene.add.graphics();

    this.percentText = config.showPercent
      ? scene.add.text(0, 0, `${Math.round(this.currentValue)}%`, {
          fontFamily: fontStack.display,
          fontSize: typeScale.labelSm.cssSize,
          fontStyle: '800',
          color: '#FFFFFF',
        }).setOrigin(0.5)
      : null;

    this.add(this.trackGfx);
    this.add(this.fillGfx);
    if (this.percentText) this.add(this.percentText);

    this.draw();

    scene.add.existing(this);
  }

  private draw(): void {
    const halfW = this.barWidth / 2;
    const halfH = this.barHeight / 2;
    const radius = halfH;

    this.trackGfx.clear();
    this.trackGfx.fillStyle(ink.outlineSoft.num, 1);
    this.trackGfx.fillRoundedRect(-halfW, -halfH, this.barWidth, this.barHeight, radius);
    this.trackGfx.lineStyle(1.5, ink.outline.num, 1);
    this.trackGfx.strokeRoundedRect(-halfW, -halfH, this.barWidth, this.barHeight, radius);

    const fillWidth = (this.currentValue / 100) * this.barWidth;
    this.fillGfx.clear();
    if (fillWidth > 0) {
      const t = tone[this.toneName];
      this.fillGfx.fillStyle(t.base.num, 1);
      this.fillGfx.fillRoundedRect(-halfW, -halfH, fillWidth, this.barHeight, radius);
      // inner-bottom highlight to mirror the React `inset 0 -3px 0 dim`.
      this.fillGfx.fillStyle(t.dim.num, 1);
      this.fillGfx.fillRoundedRect(-halfW, halfH - 3, fillWidth, 3, radius);
    }

    if (this.percentText) {
      this.percentText.setText(`${Math.round(this.currentValue)}%`);
    }
  }

  setValue(value: number, animate = true): this {
    const target = clamp(value, 0, 100);

    if (this.activeTween) {
      this.activeTween.stop();
      this.activeTween = null;
    }

    if (!animate || prefersReducedMotion()) {
      this.currentValue = target;
      this.draw();
      return this;
    }

    const obj = { v: this.currentValue };
    this.activeTween = this.scene.tweens.add({
      targets: obj,
      v: target,
      duration: duration.slow,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.currentValue = obj.v;
        this.draw();
      },
      onComplete: () => {
        this.activeTween = null;
      },
    });
    return this;
  }

  getValue(): number {
    return this.currentValue;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
