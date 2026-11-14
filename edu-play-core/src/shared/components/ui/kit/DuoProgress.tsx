'use client';

import { useReducedMotion } from 'framer-motion';
import { cn } from '@/shared/lib/utils/cn';

type Tone = 'green' | 'blue' | 'coral' | 'gold' | 'purple';

export interface DuoProgressProps {
  /** Progress value (0-100). Ignored when `indeterminate` is true. */
  value?: number;
  tone?: Tone;
  height?: 8 | 10 | 14 | 16 | number;
  showPct?: boolean;
  showPercent?: boolean;
  /** When true, shows a cycling animation for unknown progress. */
  indeterminate?: boolean;
  label?: string;
  ariaLabel?: string;
  className?: string;
}

export interface DuoProgressRingProps {
  value: number;
  tone?: Tone;
  size?: number;
  strokeWidth?: number;
  /** Accessible label for screen readers. Defaults to "Progres" when omitted. */
  label?: string;
  className?: string;
}

const TONE_COLOR: Record<Tone, { fill: string; dim: string }> = {
  green:  { fill: 'var(--color-primary)', dim: 'var(--color-primary-dim)' },
  blue:   { fill: 'var(--color-blue)',    dim: 'var(--color-blue-dim)' },
  coral:  { fill: 'var(--color-coral)',   dim: 'var(--color-coral-dim)' },
  gold:   { fill: 'var(--color-gold)',    dim: 'var(--color-gold-dim)' },
  purple: { fill: 'var(--color-purple)',  dim: 'var(--color-purple-dim)' },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function DuoProgress({
  value = 0,
  tone = 'green',
  height = 10,
  showPct,
  showPercent,
  indeterminate = false,
  label,
  ariaLabel,
  className,
}: DuoProgressProps) {
  const shouldReduceMotion = useReducedMotion();
  const clamped = clamp(value, 0, 100);
  const { fill, dim } = TONE_COLOR[tone];

  return (
    <div>
      {label && <p className="mb-2 text-body-sm font-bold text-on-surface">{label}</p>}
      <div
        role="progressbar"
        aria-label={ariaLabel || label || 'Progres'}
        aria-valuenow={indeterminate ? undefined : clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn('bg-outline-variant rounded-full border-[1.5px] border-outline relative overflow-hidden', className)}
        style={{ height }}
      >
        {indeterminate ? (
          <div
            className="ep-progress-indeterminate absolute top-0 h-full rounded-full"
            style={{
              width: '40%',
              backgroundColor: fill,
              boxShadow: `inset 0 -3px 0 ${dim}`,
            }}
          />
        ) : (
          <div
            className="absolute left-0 top-0 h-full w-full rounded-full origin-left"
            style={{
              backgroundColor: fill,
              boxShadow: `inset 0 -3px 0 ${dim}`,
              transform: `scaleX(${clamped / 100})`,
              transition: shouldReduceMotion ? 'none' : 'transform var(--t-base) var(--ease-press)',
            }}
          />
        )}
        {!indeterminate && (showPct || showPercent) && (
          <span className="absolute inset-0 flex items-center justify-center font-bold text-[11px] text-surface-container-lowest">
            {Math.round(clamped)}%
          </span>
        )}
      </div>
    </div>
  );
}

export function DuoProgressRing({
  value,
  tone = 'green',
  size = 48,
  strokeWidth = 4,
  label,
  className,
}: DuoProgressRingProps) {
  const shouldReduceMotion = useReducedMotion();
  const clamped = clamp(value, 0, 100);
  const { fill } = TONE_COLOR[tone];
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg
      role="progressbar"
      aria-label={label || 'Progres'}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      width={size}
      height={size}
      className={cn(className)}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-outline-variant)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={fill}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: shouldReduceMotion ? 'none' : 'stroke-dashoffset 400ms' }}
      />
    </svg>
  );
}
