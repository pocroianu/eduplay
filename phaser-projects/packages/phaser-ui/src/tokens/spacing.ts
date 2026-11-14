/**
 * Duo spacing scale — 4-based.
 * Mirror of `--spacing-*` in `edu-play-core/src/app/globals.css`.
 */
export const spacing = {
  s0:  0,
  s1:  4,
  s2:  8,
  s3:  12,
  s4:  16,
  s5:  20,
  s6:  24,
  s8:  32,
  s10: 40,
  s12: 48,
  s16: 64,
  s20: 80,
} as const;

/**
 * Duo radii. Mirror of `--radius-*` in globals.css.
 */
export const radii = {
  xs:        8,
  sm:        10,
  md:        14,
  lg:        18,
  xl:        24,
  pill:      999,
  kidCard:   22,
  kidButton: 18,
} as const;

/**
 * Duo icon stops — Phosphor uses these exact sizes, no in-between.
 */
export const iconSize = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
} as const;

/**
 * Duo layout constants. Useful when laying out HUD chrome that should match
 * the host shell's nav rail / topbar heights.
 */
export const layout = {
  max:        1440,
  narrow:     960,
  content:    760,
  navRail:    64,
  navRailWide: 240,
  topbar:     64,
  topbarKid:  76,
} as const;
