/**
 * Duo type tokens — Baloo 2 everywhere, JetBrains Mono for code.
 * Mirror of the type scale and font weights in
 * `edu-play-core/src/app/globals.css`.
 *
 * Phaser uses CSS-style font strings, so sizes are exposed as `'24px'`
 * strings and as raw numbers for layout math.
 */

/**
 * Stack used when Phaser falls back through `font-family`. Order matches
 * `--font-display` / `--font-body` in globals.css.
 */
export const fontStack = {
  display: '"Baloo 2", system-ui, -apple-system, sans-serif',
  body:    '"Baloo 2", system-ui, -apple-system, sans-serif',
  mono:    '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export interface TypeStop {
  /** Numeric size in px — useful for measure/layout. */
  readonly size: number;
  /** CSS-style font string used by Phaser.Text. */
  readonly cssSize: string;
  /** Font weight as a `Phaser.Text` `fontStyle`. */
  readonly weight: '400' | '500' | '600' | '700' | '800';
}

const stop = (size: number, weight: TypeStop['weight']): TypeStop => ({
  size,
  cssSize: `${size}px`,
  weight,
});

/**
 * Type stops — match `.type-*` helper classes in globals.css.
 */
export const typeScale = {
  displayXl: stop(64, '800'),
  displayLg: stop(48, '800'),
  displayMd: stop(36, '800'),
  displaySm: stop(28, '800'),
  headline:  stop(22, '800'),
  title:     stop(18, '700'),
  bodyLg:    stop(16, '600'),
  body:      stop(14, '500'),
  label:     stop(12, '700'),
  labelSm:   stop(11, '700'),
} as const;

/**
 * Convenience: build a `Phaser.Types.GameObjects.Text.TextStyle` from a Duo
 * type stop. Color defaults to `var(--color-on-surface)` (#1F2937).
 */
export function phaserTextStyle(
  s: TypeStop,
  options: { color?: string; family?: 'display' | 'body' | 'mono'; align?: 'left' | 'center' | 'right' } = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  const family = options.family ?? 'display';
  return {
    fontFamily: fontStack[family],
    fontSize: s.cssSize,
    fontStyle: s.weight,
    color: options.color ?? '#1F2937',
    align: options.align ?? 'left',
  };
}
