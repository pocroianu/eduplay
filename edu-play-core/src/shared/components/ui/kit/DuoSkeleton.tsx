'use client';

import { cn } from '@/shared/lib/utils/cn';

type Variant = 'text' | 'circle' | 'rect' | 'button' | 'card';

export interface DuoSkeletonProps {
  /** Shape preset. */
  variant?: Variant;
  /** Width override (CSS value). Defaults vary by variant. */
  width?: string | number;
  /** Height override (CSS value). Defaults vary by variant. */
  height?: string | number;
  /** Number of skeleton lines to render (only for variant="text"). */
  lines?: number;
  /** Whether to animate the shimmer. Defaults to true. */
  animate?: boolean;
  className?: string;
}

const VARIANT_CLASS: Record<Variant, string> = {
  text: 'h-4 rounded-full',
  circle: 'rounded-full',
  rect: 'rounded-md',
  button: 'h-11 rounded-md',
  card: 'rounded-md',
};

const VARIANT_DEFAULTS: Record<Variant, { width?: string; height?: string }> = {
  text: { width: '100%', height: undefined },
  circle: { width: '48px', height: '48px' },
  rect: { width: '100%', height: '80px' },
  button: { width: '120px', height: '44px' },
  card: { width: '100%', height: '160px' },
};

/**
 * DuoSkeleton — loading placeholder primitive with a Seesaw-style shimmer effect.
 *
 * Respects `prefers-reduced-motion` via CSS media query on the animation.
 */
function DuoSkeleton({
  variant = 'text',
  width,
  height,
  lines = 1,
  animate = true,
  className,
}: DuoSkeletonProps) {
  const defaults = VARIANT_DEFAULTS[variant];
  const resolvedWidth = width ?? defaults.width;
  const resolvedHeight = height ?? defaults.height;

  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('flex flex-col gap-2.5', className)} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={cn(
              'bg-surface-container-high',
              VARIANT_CLASS.text,
              animate && 'ep-skeleton-shimmer',
            )}
            style={{
              width: i === lines - 1 ? '75%' : '100%',
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-surface-container-high',
        VARIANT_CLASS[variant],
        animate && 'ep-skeleton-shimmer',
        className,
      )}
      style={{
        width: resolvedWidth,
        height: resolvedHeight,
      }}
    />
  );
}
