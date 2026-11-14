/**
 * Duo chunky 3D shadow tokens — `0 Npx 0 0 <color>` (no blur). The depth and
 * shadow color is the visual signature of the system.
 *
 * Phaser doesn't have a CSS `box-shadow` equivalent, so we model these as
 * `(depthPx, color)` pairs and let primitives draw the offset rectangle by
 * hand. Mirror of `--shadow-chunk-*` in globals.css.
 */

import { primary, gold, blue, coral, purple, ink, type DuoColor } from './colors';

export interface ChunkShadow {
  readonly depth: number;
  readonly color: DuoColor;
}

const chunk = (depth: number, color: DuoColor): ChunkShadow => ({ depth, color });

export const shadows = {
  chunkSm:     chunk(3, ink.base),
  chunk:       chunk(4, ink.base),
  chunkLg:     chunk(6, ink.base),
  chunkGreen:  chunk(4, primary.dim),
  chunkGold:   chunk(4, gold.dim),
  chunkCoral:  chunk(4, coral.dim),
  chunkBlue:   chunk(4, blue.dim),
  chunkPurple: chunk(4, purple.dim),
} as const;
