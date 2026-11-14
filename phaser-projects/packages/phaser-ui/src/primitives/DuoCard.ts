import Phaser from 'phaser';
import { ink, surface, tone, type ToneName } from '../tokens/colors';
import { shadows } from '../tokens/shadows';
import { radii } from '../tokens/spacing';

/**
 * DuoCard — Phaser mirror of `kit/DuoCard.tsx`.
 *
 * Variants:
 *   - `default`     — surface-container-lowest with a soft outline border
 *   - `interactive` — same as default plus pointer + hover lift behaviour
 *   - `chunky`      — 3px ink border + chunky shadow underneath
 *   - `hero`        — gradient fill from `tone.base` to `tone.dim` with white text
 *
 * Width and height are explicit because Phaser containers don't have layout
 * the way CSS does; pass the size you want the card to occupy.
 *
 * Default radius is `radii.kidCard` (22): every Phaser game canvas in this
 * monorepo is a kid surface, so we mirror the host's `--radius-kid-card`
 * rather than the React `DuoCard.tsx` literal `16` (which is the neutral
 * default for mixed-context use in admin/teacher/parent shells).
 */

export type DuoCardVariant = 'default' | 'interactive' | 'chunky' | 'hero';

export interface DuoCardConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  variant?: DuoCardVariant;
  /** Tone for `hero` variant. Defaults to `green`. */
  tone?: ToneName;
  radius?: number;
  /** Optional content rendered inside the card. Position is relative to the card's center. */
  content?: Phaser.GameObjects.GameObject[];
}

const DEFAULT_RADIUS = radii.kidCard;

export class DuoCard extends Phaser.GameObjects.Container {
  readonly cardWidth: number;
  readonly cardHeight: number;
  private readonly variant: DuoCardVariant;
  private readonly toneName: ToneName;
  private readonly radius: number;
  private readonly bodyGfx: Phaser.GameObjects.Graphics;
  private readonly shadowGfx: Phaser.GameObjects.Graphics;
  private readonly heroOverlay: Phaser.GameObjects.Graphics | null;
  private isHovering = false;

  constructor(scene: Phaser.Scene, config: DuoCardConfig) {
    super(scene, config.x, config.y);

    this.cardWidth = config.width;
    this.cardHeight = config.height;
    this.variant = config.variant ?? 'default';
    this.toneName = config.tone ?? 'green';
    this.radius = config.radius ?? DEFAULT_RADIUS;

    this.shadowGfx = scene.add.graphics();
    this.bodyGfx = scene.add.graphics();
    this.heroOverlay = this.variant === 'hero' ? scene.add.graphics() : null;

    this.add(this.shadowGfx);
    this.add(this.bodyGfx);
    if (this.heroOverlay) this.add(this.heroOverlay);
    if (config.content) this.add(config.content);

    this.draw();

    if (this.variant === 'interactive') {
      const hit = scene.add.zone(0, 0, this.cardWidth, this.cardHeight + 8);
      hit.setOrigin(0.5);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.setHovering(true));
      hit.on('pointerout',  () => this.setHovering(false));
      this.add(hit);
    }

    scene.add.existing(this);
  }

  private draw(): void {
    const halfW = this.cardWidth / 2;
    const halfH = this.cardHeight / 2;

    this.shadowGfx.clear();
    this.bodyGfx.clear();
    this.heroOverlay?.clear();

    if (this.variant === 'chunky' || this.variant === 'hero') {
      const s = shadows.chunkLg;
      this.shadowGfx.fillStyle(s.color.num, 1);
      this.shadowGfx.fillRoundedRect(-halfW, -halfH + s.depth, this.cardWidth, this.cardHeight, this.radius);
    }

    if (this.variant === 'hero') {
      const family = tone[this.toneName];
      const baseY = this.isHovering ? -2 : 0;
      this.bodyGfx.fillStyle(family.base.num, 1);
      this.bodyGfx.fillRoundedRect(-halfW, -halfH + baseY, this.cardWidth, this.cardHeight, this.radius);
      // Bottom-half gradient is faked with a second band in `dim`.
      this.heroOverlay!.fillStyle(family.dim.num, 0.45);
      this.heroOverlay!.fillRoundedRect(-halfW, baseY, this.cardWidth, halfH, this.radius);
      this.bodyGfx.lineStyle(3, ink.base.num, 1);
      this.bodyGfx.strokeRoundedRect(-halfW, -halfH + baseY, this.cardWidth, this.cardHeight, this.radius);
      return;
    }

    const fill = surface.containerLowest.num;
    const stroke = this.variant === 'chunky' ? ink.base.num : ink.outlineSoft.num;
    const strokeWidth = this.variant === 'chunky' ? 3 : 2;
    const baseY = this.isHovering ? -2 : 0;

    this.bodyGfx.fillStyle(fill, 1);
    this.bodyGfx.fillRoundedRect(-halfW, -halfH + baseY, this.cardWidth, this.cardHeight, this.radius);
    this.bodyGfx.lineStyle(strokeWidth, stroke, 1);
    this.bodyGfx.strokeRoundedRect(-halfW, -halfH + baseY, this.cardWidth, this.cardHeight, this.radius);
  }

  private setHovering(hovering: boolean): void {
    if (this.variant !== 'interactive' && this.variant !== 'hero') return;
    if (hovering === this.isHovering) return;
    this.isHovering = hovering;
    this.draw();
  }
}
