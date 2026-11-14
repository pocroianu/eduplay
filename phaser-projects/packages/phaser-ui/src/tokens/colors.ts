/**
 * Duo color tokens — mirror of the non-legacy `--color-*` block in
 * `edu-play-core/src/app/globals.css`.
 *
 * Each color is exposed in two forms:
 *   - `hex`: `#RRGGBB` (use with Phaser.Text styles, CSS-style values).
 *   - `num`: `0xRRGGBB` (use with Phaser.Graphics, tints, fillStyle).
 *
 * Keep the order and naming consistent with globals.css so a diff makes it
 * obvious when the two drift.
 */

export interface DuoColor {
  readonly hex: string;
  readonly num: number;
}

const c = (hex: string): DuoColor => ({
  hex,
  num: parseInt(hex.slice(1), 16),
});

// Primary · Signature green
export const primary = {
  base: c('#22C55E'),
  dim:  c('#16A34A'),
  deep: c('#166534'),
  soft: c('#DCFCE7'),
  wash: c('#EAFBF2'),
  on:   c('#FFFFFF'),
} as const;

// Secondary · Gold (XP, trophies, warmth)
export const gold = {
  base: c('#FFC93C'),
  dim:  c('#D4A012'),
  deep: c('#7A5200'),
  soft: c('#FFF3CE'),
  wash: c('#FFFAE5'),
  on:   c('#4A3700'),
} as const;

// Accent · Blue (gems, secondary CTAs)
export const blue = {
  base: c('#2FB5E8'),
  dim:  c('#1A8FC2'),
  deep: c('#0E5A7A'),
  soft: c('#D9F1FB'),
  wash: c('#EDF7FC'),
  on:   c('#FFFFFF'),
} as const;

// Accent · Coral (hearts, attention, soft errors)
export const coral = {
  base: c('#FF6B6B'),
  dim:  c('#E04545'),
  deep: c('#8C1D1D'),
  soft: c('#FFE1E1'),
  wash: c('#FFF1F1'),
  on:   c('#FFFFFF'),
} as const;

// Accent · Purple (Scânteia, magic moments)
export const purple = {
  base: c('#8B5CF6'),
  dim:  c('#6B3FD4'),
  deep: c('#4C1F96'),
  soft: c('#E8DDFD'),
  wash: c('#F4EEFE'),
  on:   c('#FFFFFF'),
} as const;

// Accent · Pink (arts, creative subjects)
export const pink = {
  base: c('#FF7EB9'),
  dim:  c('#E04F95'),
  deep: c('#8A2661'),
  soft: c('#FFE1EE'),
  wash: c('#FFF1F7'),
} as const;

// Error · Hard stop (distinct from coral)
export const error = {
  base: c('#DC2626'),
  dim:  c('#B91C1C'),
  soft: c('#FECACA'),
  on:   c('#FFFFFF'),
} as const;

// Surfaces · Seesaw-soft off-white
export const surface = {
  base:               c('#F7F9FB'),
  alt:                c('#EEF2F6'),
  containerLowest:    c('#FFFFFF'),
  containerLow:       c('#FAFBFC'),
  container:          c('#F3F5F8'),
  containerHigh:      c('#EAEEF2'),
  containerHighest:   c('#DDE3EA'),
} as const;

// Ink · borders and text
export const ink = {
  base:        c('#1F2937'),
  shadow:      c('#111827'),
  onSurface:   c('#1F2937'),
  variant:     c('#4B5563'),
  muted:       c('#6B7280'),
  faint:       c('#9CA3AF'),
  outline:     c('#D1D5DB'),
  outlineSoft: c('#E5E7EB'),
} as const;

// Subject palette (chips, pills, avatars)
export const subject = {
  math:        c('#2FB5E8'),
  mathSoft:    c('#D9F1FB'),
  romana:      c('#FF6B6B'),
  romanaSoft:  c('#FFE1E1'),
  stiinte:     c('#22C55E'),
  stiinteSoft: c('#DCFCE7'),
  arte:        c('#FF7EB9'),
  arteSoft:    c('#FFE1EE'),
  muzica:      c('#8B5CF6'),
  muzicaSoft:  c('#E8DDFD'),
  sport:       c('#FFC93C'),
  sportSoft:   c('#FFF3CE'),
} as const;

// Status (lesson cards, quest map nodes)
export const status = {
  done:   c('#22C55E'),
  active: c('#FFC93C'),
  locked: c('#D1D5DB'),
  stuck:  c('#FF6B6B'),
} as const;

export type ToneName = 'green' | 'gold' | 'blue' | 'coral' | 'purple' | 'pink';

/**
 * Tone groups indexed by the same names ChunkyButton / DuoCard / DuoProgress
 * accept on the React side. Useful when you want to take a `tone` prop and
 * pull the matching family without a switch.
 */
export const tone: Record<ToneName, { base: DuoColor; dim: DuoColor; deep?: DuoColor; soft: DuoColor; on: DuoColor }> = {
  green:  { base: primary.base, dim: primary.dim, deep: primary.deep, soft: primary.soft, on: primary.on },
  gold:   { base: gold.base,    dim: gold.dim,    deep: gold.deep,    soft: gold.soft,    on: gold.on    },
  blue:   { base: blue.base,    dim: blue.dim,    deep: blue.deep,    soft: blue.soft,    on: blue.on    },
  coral:  { base: coral.base,   dim: coral.dim,   deep: coral.deep,   soft: coral.soft,   on: coral.on   },
  purple: { base: purple.base,  dim: purple.dim,  deep: purple.deep,  soft: purple.soft,  on: purple.on  },
  pink:   { base: pink.base,    dim: pink.dim,    deep: pink.deep,    soft: pink.soft,    on: ink.base   },
} as const;

export const colors = {
  primary,
  gold,
  blue,
  coral,
  purple,
  pink,
  error,
  surface,
  ink,
  subject,
  status,
  tone,
} as const;
