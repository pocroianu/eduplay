import Phaser from 'phaser';
import { coral, gold, blue, ink } from '../tokens/colors';

/**
 * DuoGlyph — Phaser mirror of `kit/DuoGlyph.tsx`.
 *
 * The React component uses inline SVG paths. Phaser's Graphics primitive
 * does not expose cubic-bezier path commands, so each glyph here is drawn
 * with circles and polygons that approximate the silhouette at HUD size.
 * The colour palette and `kind` union are kept identical to the React kit.
 */

export type DuoGlyphKind = 'heart' | 'gem' | 'xp' | 'trophy' | 'flame';

export interface DuoGlyphConfig {
  x: number;
  y: number;
  kind: DuoGlyphKind;
  size?: number;
  /** For `flame` only: dim the glyph when the streak isn't active. */
  on?: boolean;
}

const VIEWBOX = 24;

export class DuoGlyph extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, config: DuoGlyphConfig) {
    super(scene, config.x, config.y);

    const size = config.size ?? 22;
    const gfx = scene.add.graphics();

    switch (config.kind) {
      case 'heart':
        drawHeart(gfx);
        break;
      case 'gem':
        drawGem(gfx);
        break;
      case 'xp':
        drawXp(gfx);
        break;
      case 'trophy':
        drawTrophy(gfx);
        break;
      case 'flame':
        drawFlame(gfx, config.on !== false);
        break;
    }

    this.add(gfx);
    this.setScale(size / VIEWBOX);

    scene.add.existing(this);
  }
}

function drawHeart(g: Phaser.GameObjects.Graphics): void {
  // Two circles + triangle fill — silhouette of a 24x24 heart centered on (0,0).
  // Coordinates are pre-translated so the container's origin sits at the heart's center.
  g.fillStyle(coral.base.num, 1);
  g.lineStyle(1.5, coral.dim.num, 1);

  // Filled body: circles + triangle joined.
  g.fillCircle(-5, -3, 5);
  g.fillCircle(5, -3, 5);
  g.beginPath();
  g.moveTo(-9.5, 0);
  g.lineTo(9.5, 0);
  g.lineTo(0, 10);
  g.closePath();
  g.fillPath();

  // Outline (drawn on top to clean up the seam).
  g.strokeCircle(-5, -3, 5);
  g.strokeCircle(5, -3, 5);
}

function drawGem(g: Phaser.GameObjects.Graphics): void {
  // Diamond M12 2 L22 10 L12 22 L2 10 Z, recentered to (0,0).
  g.fillStyle(blue.base.num, 1);
  g.lineStyle(1.5, blue.dim.num, 1);
  g.beginPath();
  g.moveTo(0, -10);
  g.lineTo(10, -2);
  g.lineTo(0, 10);
  g.lineTo(-10, -2);
  g.closePath();
  g.fillPath();
  g.strokePath();

  // Inner highlight diamond (white @ 35% alpha).
  g.fillStyle(0xFFFFFF, 0.35);
  g.beginPath();
  g.moveTo(-5, -2);
  g.lineTo(0, -6);
  g.lineTo(5, -2);
  g.lineTo(0, 2);
  g.closePath();
  g.fillPath();
}

function drawXp(g: Phaser.GameObjects.Graphics): void {
  // Five-point star, recentered to (0,0).
  g.fillStyle(gold.base.num, 1);
  g.lineStyle(1.5, gold.dim.num, 1);
  const cx = 0;
  const cy = 0;
  const outer = 11;
  const inner = 5;
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    points.push(cx + Math.cos(angle) * r);
    points.push(cy + Math.sin(angle) * r);
  }
  g.beginPath();
  g.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

function drawTrophy(g: Phaser.GameObjects.Graphics): void {
  // Cup body — rectangle with rounded bottom approximated as a polygon.
  g.fillStyle(gold.base.num, 1);
  g.lineStyle(1.5, gold.dim.num, 1);

  // Cup
  g.beginPath();
  g.moveTo(-6, -8);
  g.lineTo(6, -8);
  g.lineTo(6, 0);
  g.lineTo(4, 4);
  g.lineTo(-4, 4);
  g.lineTo(-6, 0);
  g.closePath();
  g.fillPath();
  g.strokePath();

  // Handles
  g.fillCircle(-7.5, -5, 2.5);
  g.strokeCircle(-7.5, -5, 2.5);
  g.fillCircle(7.5, -5, 2.5);
  g.strokeCircle(7.5, -5, 2.5);

  // Stem
  g.fillStyle(gold.dim.num, 1);
  g.fillRect(-3, 4, 6, 3);

  // Base
  g.fillStyle(ink.base.num, 1);
  g.fillRoundedRect(-5, 7, 10, 3, 1);
}

function drawFlame(g: Phaser.GameObjects.Graphics, on: boolean): void {
  const outerFill = on ? coral.base.num   : 0xD1D5DB;
  const outerStroke = on ? coral.dim.num : 0x9CA3AF;
  const innerFill = on ? gold.base.num    : 0xE5E7EB;

  // Outer teardrop polygon (12 sample points).
  g.fillStyle(outerFill, 1);
  g.lineStyle(1.5, outerStroke, 1);
  g.beginPath();
  g.moveTo(0, -11);
  g.lineTo(4, -5);
  g.lineTo(7, -1);
  g.lineTo(8, 4);
  g.lineTo(6, 9);
  g.lineTo(0, 11);
  g.lineTo(-6, 9);
  g.lineTo(-8, 4);
  g.lineTo(-7, -1);
  g.lineTo(-4, -5);
  g.closePath();
  g.fillPath();
  g.strokePath();

  // Inner teardrop polygon (smaller).
  g.fillStyle(innerFill, 1);
  g.beginPath();
  g.moveTo(0, -4);
  g.lineTo(2, -1);
  g.lineTo(4, 2);
  g.lineTo(3, 6);
  g.lineTo(0, 8);
  g.lineTo(-3, 6);
  g.lineTo(-4, 2);
  g.lineTo(-2, -1);
  g.closePath();
  g.fillPath();
}
