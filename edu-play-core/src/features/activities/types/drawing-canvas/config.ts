// Drawing Canvas — config schema, palette tokens, brush sizes.
//
// Pure data-only module so the registry definition (server-bundled) and the
// renderer (client-bundled) can both import it without crossing the
// 'use client' boundary. No React, no DOM.
//
// Per EDU-293 § 1.3:
//   - Palette: six tokens, "ink" selected on first paint.
//   - Brush sizes: small / medium / large, indicator diameters 12 / 22 / 36 px.
// Per the issue scope: configSchema is `{ mode, templateImageUrl?, backgroundColor? }`.

import { z } from 'zod';

export const BRUSH_SIZES = ['small', 'medium', 'large'] as const;
export type BrushSize = (typeof BRUSH_SIZES)[number];

export const DEFAULT_BRUSH_SIZE: BrushSize = 'medium';

/**
 * Stroke width (px) on the canvas itself. Indicator-glyph diameters in the
 * tool rail (12 / 22 / 36) are smaller for visual rhythm; what gets painted
 * is what's listed here. Numbers picked so the small size still leaves a
 * confident mark on a 64×64 hit area, and the large size doesn't drown a
 * 768-px-wide canvas.
 */
export const BRUSH_STROKE_PX: Record<BrushSize, number> = {
  small: 4,
  medium: 10,
  large: 18,
};

/**
 * Tool-rail indicator-circle diameter (px) per EDU-293 § 1.3.
 */
export const BRUSH_INDICATOR_PX: Record<BrushSize, number> = {
  small: 12,
  medium: 22,
  large: 36,
};

export const BRUSH_LABELS: Record<BrushSize, string> = {
  small: 'Pensulă mică',
  medium: 'Pensulă mijlocie',
  large: 'Pensulă mare',
};

/**
 * Six-color kid-mode palette per EDU-293 § 1.3.
 *
 * Each entry stores the CSS variable token (rendered as `var(--color-…)` at
 * paint time) plus the Romanian name surfaced to screen readers. Pink is
 * intentionally omitted from the default palette (see spec).
 *
 * `id` is the stable identifier used in state and tests; `cssVar` is the
 * resolved token name. Tokens land in `globals.css` under `--color-*`.
 */
export interface PaletteSwatch {
  id: PaletteColorId;
  cssVar: string;
  label: string;
}

export const PALETTE_COLOR_IDS = [
  'ink',
  'coral',
  'gold',
  'primary',
  'blue',
  'purple',
] as const;
export type PaletteColorId = (typeof PALETTE_COLOR_IDS)[number];

export const DEFAULT_PALETTE_COLOR: PaletteColorId = 'ink';

export const PALETTE: ReadonlyArray<PaletteSwatch> = [
  { id: 'ink', cssVar: '--color-on-surface', label: 'Negru' },
  { id: 'coral', cssVar: '--color-coral', label: 'Coral' },
  { id: 'gold', cssVar: '--color-gold', label: 'Auriu' },
  { id: 'primary', cssVar: '--color-primary', label: 'Verde' },
  { id: 'blue', cssVar: '--color-blue', label: 'Albastru' },
  { id: 'purple', cssVar: '--color-purple', label: 'Mov' },
];

const PALETTE_BY_ID: Record<PaletteColorId, PaletteSwatch> = PALETTE.reduce(
  (acc, swatch) => {
    acc[swatch.id] = swatch;
    return acc;
  },
  {} as Record<PaletteColorId, PaletteSwatch>,
);

export function getPaletteSwatch(id: PaletteColorId): PaletteSwatch {
  return PALETTE_BY_ID[id];
}

/**
 * Drawing-canvas instance config schema. Authored by teachers via F11 (CMS)
 * or seeded in fixtures; validated at the registry boundary by the player
 * shell before the renderer mounts.
 *
 * - `mode: 'freeform'` — blank canvas. Default.
 * - `mode: 'guided'`   — same canvas, but `prompt` and an optional
 *   `templateImageUrl` shape what the child is drawing. The renderer passes
 *   `prompt` into the encouragement bubble; `templateImageUrl` is honored
 *   in a follow-up phase.
 *
 * `backgroundColor` accepts a kid-friendly token id (no raw hex). Empty /
 * omitted means white (`--color-surface-container-lowest`). We intentionally
 * keep the surface narrow now and widen later.
 */
export const drawingCanvasConfigSchema = z.object({
  mode: z.enum(['freeform', 'guided']).default('freeform'),
  prompt: z.string().trim().min(1).max(280).optional(),
  templateImageUrl: z.string().url().optional(),
  backgroundColor: z
    .enum(['white', 'cream', 'sky', 'mint'])
    .default('white'),
});

export type DrawingCanvasConfig = z.infer<typeof drawingCanvasConfigSchema>;

/**
 * Renderer result. The renderer owns the submit pipeline (server-action
 * upload → `RewardModal`), so the shell only needs the durable handle to
 * the saved artifact for any post-completion bookkeeping. Forwarding the
 * raw PNG dataURL would let the shell's `JSON.stringify(result)` preview
 * dump megabytes of base64 onto the page, so we deliberately ship just
 * the artifact id (UUID).
 */
export interface DrawingCanvasResult {
  artifactId: string;
}

/**
 * Background-color token map. Only the four canvas backgrounds the schema
 * accepts; everything else falls back to surface-container-lowest. The
 * renderer reads `var(...)` straight off this map at paint time.
 */
export const BACKGROUND_COLOR_TOKENS: Record<
  DrawingCanvasConfig['backgroundColor'],
  string
> = {
  white: '--color-surface-container-lowest',
  cream: '--color-gold-wash',
  sky: '--color-blue-wash',
  mint: '--color-primary-wash',
};
