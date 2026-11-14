/**
 * Duo motion tokens — mirror of `--ease-*` and `--t-*` in
 * `edu-play-core/src/app/globals.css`.
 *
 * Phaser tweens accept CSS-style cubic-bezier names via `Phaser.Math.Easing`
 * helpers, but here we expose both the raw cubic-bezier coefficients (for
 * SVG / CSS use) and the closest Phaser easing name for game tweens.
 */

export const easing = {
  /** Snappy press-down easing — `cubic-bezier(0.2, 0.8, 0.2, 1)`. */
  press: {
    cssCubicBezier: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    coefficients:   [0.2, 0.8, 0.2, 1] as const,
    /** Closest stock Phaser easing for game tweens. */
    phaser: 'Cubic.easeOut',
  },
  /** Springy pop-in easing — `cubic-bezier(0.34, 1.56, 0.64, 1)`. */
  spring: {
    cssCubicBezier: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    coefficients:   [0.34, 1.56, 0.64, 1] as const,
    phaser: 'Back.easeOut',
  },
} as const;

/**
 * Duration stops in ms — match `--t-press`, `--t-fast`, `--t-base`, `--t-slow`.
 */
export const duration = {
  press: 80,
  fast:  150,
  base:  240,
  slow:  400,
} as const;
