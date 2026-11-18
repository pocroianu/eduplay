import Phaser from 'phaser';
import { primary, ink, coral } from '../tokens/colors';
import { prefersReducedMotion } from './reducedMotion';

/**
 * Vulpița — Phaser mirror of `kit/Vulpita.tsx`.
 *
 * The React component uses inline SVG. Phaser games can't load SVG directly,
 * so the mascot is composed from circles, ellipses, and polygons drawn by
 * `Phaser.GameObjects.Graphics`. The mood prop is preserved 1:1 — eyes and
 * mouth swap based on the mood, exactly like the React version.
 *
 * Coordinate system: 120x120 viewBox centered on the container origin (0,0).
 * The container scales itself so the rendered mascot is `size` pixels wide.
 */

export type VulpitaMood = 'happy' | 'cheer' | 'thinking' | 'sleep';

export interface VulpitaConfig {
  x: number;
  y: number;
  size?: number;
  mood?: VulpitaMood;
  /** Subtle idle breath animation (gentle scale loop). Defaults to true. */
  animate?: boolean;
}

const VIEWBOX = 120;
const FUR = 0xFF8C42;
const FUR_LIGHT = 0xFFE1CC;
const TAIL_TIP = 0xF89A5E;
const CHEEK = 0xFF6B6B;

export class Vulpita extends Phaser.GameObjects.Container {
  private readonly mood: VulpitaMood;
  private breatheTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, config: VulpitaConfig) {
    super(scene, config.x, config.y);

    this.mood = config.mood ?? 'happy';
    const size = config.size ?? 120;
    const animate = config.animate !== false && !prefersReducedMotion(scene);

    const body = scene.add.graphics();
    this.drawBody(body);
    const head = scene.add.graphics();
    this.drawHead(head);
    this.add([body, head]);

    // Recenter so (0,0) is the visual centroid of the SVG viewBox.
    body.x = -VIEWBOX / 2;
    body.y = -VIEWBOX / 2;
    head.x = -VIEWBOX / 2;
    head.y = -VIEWBOX / 2;

    this.setScale(size / VIEWBOX);

    if (animate) {
      this.breatheTween = scene.tweens.add({
        targets: this,
        scaleX: { from: this.scaleX * 0.98, to: this.scaleX * 1.02 },
        scaleY: { from: this.scaleY * 0.98, to: this.scaleY * 1.02 },
        duration: 2000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }

    scene.add.existing(this);
  }

  private drawBody(g: Phaser.GameObjects.Graphics): void {
    // Tail
    g.fillStyle(TAIL_TIP, 1);
    g.lineStyle(2.5, ink.base.num, 1);
    g.beginPath();
    g.moveTo(92, 78);
    g.lineTo(104, 52);
    g.lineTo(108, 64);
    g.lineTo(88, 70);
    g.closePath();
    g.fillPath();
    g.strokePath();

    g.fillStyle(FUR_LIGHT, 1);
    g.beginPath();
    g.moveTo(100, 58);
    g.lineTo(104, 52);
    g.lineTo(108, 56);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // Body (ellipse 60,78 rx=32 ry=28)
    g.fillStyle(FUR, 1);
    g.fillEllipse(60, 78, 64, 56);
    g.strokeEllipse(60, 78, 64, 56);

    // Belly
    g.fillStyle(FUR_LIGHT, 1);
    g.fillEllipse(60, 82, 36, 32);

    // Feet
    g.fillStyle(ink.base.num, 1);
    g.fillEllipse(48, 104, 14, 8);
    g.fillEllipse(72, 104, 14, 8);
  }

  private drawHead(g: Phaser.GameObjects.Graphics): void {
    g.lineStyle(2.5, ink.base.num, 1);

    // Head circle
    g.fillStyle(FUR, 1);
    g.fillCircle(60, 46, 28);
    g.strokeCircle(60, 46, 28);

    // Ears (triangles)
    g.fillStyle(FUR, 1);
    drawTriangle(g, [40, 30, 34, 16, 50, 26]);
    drawTriangle(g, [80, 30, 86, 16, 70, 26]);

    g.fillStyle(ink.base.num, 1);
    drawTrianglePathOnly(g, [40, 26, 38, 20, 46, 25]);
    drawTrianglePathOnly(g, [80, 26, 82, 20, 74, 25]);

    // Face markings (cream highlights either side of the muzzle)
    g.fillStyle(FUR_LIGHT, 1);
    g.beginPath();
    g.moveTo(60, 48);
    g.lineTo(48, 56);
    g.lineTo(52, 40);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(60, 48);
    g.lineTo(72, 56);
    g.lineTo(68, 40);
    g.closePath();
    g.fillPath();

    // Cheeks
    g.fillStyle(CHEEK, 0.7);
    g.fillCircle(44, 54, 3.5);
    g.fillCircle(76, 54, 3.5);

    // Nose
    g.fillStyle(ink.base.num, 1);
    g.beginPath();
    g.moveTo(58, 52);
    g.lineTo(62, 52);
    g.lineTo(60, 56);
    g.closePath();
    g.fillPath();

    // Eyes
    this.drawEyes(g);

    // Mouth
    this.drawMouth(g);

    // Bandana (signature green per the React component)
    g.fillStyle(primary.base.num, 1);
    g.lineStyle(2, ink.base.num, 1);
    g.beginPath();
    g.moveTo(34, 68);
    g.lineTo(86, 68);
    g.lineTo(84, 74);
    g.lineTo(36, 74);
    g.closePath();
    g.fillPath();
    g.strokePath();

    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(50, 71, 1.5);
    g.fillCircle(60, 73, 1.5);
    g.fillCircle(70, 71, 1.5);
  }

  private drawEyes(g: Phaser.GameObjects.Graphics): void {
    if (this.mood === 'sleep') {
      g.lineStyle(2.5, ink.base.num, 1);
      // Sleeping arcs — short curved lines
      drawArcLine(g, 48, 44, 56, 44);
      drawArcLine(g, 64, 44, 72, 44);
      return;
    }

    const ry = this.mood === 'cheer' ? 3 : 5;
    g.fillStyle(ink.base.num, 1);
    g.fillEllipse(52, 44, 8, ry * 2);
    g.fillEllipse(68, 44, 8, ry * 2);

    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(53.5, 42, 1.5);
    g.fillCircle(69.5, 42, 1.5);
  }

  private drawMouth(g: Phaser.GameObjects.Graphics): void {
    g.lineStyle(2, ink.base.num, 1);
    switch (this.mood) {
      case 'happy':
        drawArcLine(g, 56, 58, 64, 58, 4);
        break;
      case 'cheer':
        g.fillStyle(0xBC2C2C, 1);
        g.beginPath();
        g.moveTo(54, 56);
        g.lineTo(66, 56);
        g.lineTo(60, 62);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      case 'thinking':
        g.beginPath();
        g.moveTo(56, 60);
        g.lineTo(64, 60);
        g.strokePath();
        break;
      case 'sleep':
        drawArcLine(g, 56, 60, 64, 60, -2);
        break;
    }
  }

  destroy(fromScene?: boolean): void {
    if (this.breatheTween) {
      this.breatheTween.stop();
      this.breatheTween = null;
    }
    super.destroy(fromScene);
  }
}

function drawTriangle(g: Phaser.GameObjects.Graphics, pts: number[]): void {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  g.lineTo(pts[2], pts[3]);
  g.lineTo(pts[4], pts[5]);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

function drawTrianglePathOnly(g: Phaser.GameObjects.Graphics, pts: number[]): void {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  g.lineTo(pts[2], pts[3]);
  g.lineTo(pts[4], pts[5]);
  g.closePath();
  g.fillPath();
}

/**
 * Approximate a quadratic bezier mouth/eye-line with two short line segments
 * peaking through a control point. Phaser.Graphics has no built-in bezier.
 */
function drawArcLine(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, lift = 2): void {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + lift;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(cx, cy);
  g.lineTo(x2, y2);
  g.strokePath();
}
