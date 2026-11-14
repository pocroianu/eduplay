'use client';

import type { CSSProperties } from 'react';
import type { IconWeight } from '@phosphor-icons/react';
import { ICON_REGISTRY, type IconName } from './Icon.registry';

/**
 * Icon size token → pixel value. Matches `--size-icon-*` tokens in
 * `src/app/globals.css`. Keep these in sync if you add a new stop.
 *
 * The Duo design spec is strict here: 14 / 16 / 18 / 20 / 24 — no in-between.
 */
const ICON_SIZE_TOKENS = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
} as const satisfies Record<string, number>;

export type IconSizeToken = keyof typeof ICON_SIZE_TOKENS;
export type IconSize = number | IconSizeToken;

export interface IconProps {
  /** Phosphor canonical name (e.g. `House`, `Compass`, `Sparkle`). */
  name: IconName;
  /** Phosphor weight. Defaults to Duo's `bold`; use `fill` for selected or celebratory states. */
  weight?: IconWeight;
  /** Pixel size or a `--size-icon-*` token (`xs|sm|md|lg|xl`). Defaults to 24. */
  size?: IconSize;
  /** Mirror horizontally (matches Phosphor's `mirrored` prop). */
  mirrored?: boolean;
  /** Tailwind/utility classes forwarded to the underlying `<svg>`. */
  className?: string;
  /** Inline style forwarded to the underlying `<svg>`. */
  style?: CSSProperties;
  /**
   * Accessible label. Providing this promotes the icon from decorative
   * (`aria-hidden="true"`) to a labelled `role="img"` element.
   */
  'aria-label'?: string;
  /**
   * Override the default decorative behaviour. Leave `undefined` to fall back
   * to the auto-rule (decorative when no `aria-label` is provided).
   */
  'aria-hidden'?: boolean;
}

function resolveSize(size: IconSize | undefined): number {
  if (size === undefined) return ICON_SIZE_TOKENS.xl;
  if (typeof size === 'number') return size;
  return ICON_SIZE_TOKENS[size];
}

/**
 * Thin wrapper around `@phosphor-icons/react` so feature code never imports
 * Phosphor glyphs directly.
 *
 * See `docs/ui-kit.md` import rules and `DESIGN.md` §3.6.
 */
export function Icon({
  name,
  weight = 'bold',
  size,
  mirrored,
  className,
  style,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
}: IconProps) {
  const Glyph = ICON_REGISTRY[name];
  const pixelSize = resolveSize(size);
  const labelled = typeof ariaLabel === 'string' && ariaLabel.length > 0;
  const hidden = ariaHidden ?? !labelled;

  return (
    <Glyph
      weight={weight}
      size={pixelSize}
      mirrored={mirrored}
      className={className}
      style={style}
      aria-hidden={hidden}
      aria-label={labelled ? ariaLabel : undefined}
      role={labelled ? 'img' : undefined}
    />
  );
}
