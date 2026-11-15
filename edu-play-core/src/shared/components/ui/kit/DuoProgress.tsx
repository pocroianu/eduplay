"use client";

import { Progress, RingProgress } from "@mantine/core";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/shared/lib/utils/cn";
import { MantineBoundary } from "./MantineBoundary";

type Tone = "green" | "blue" | "coral" | "gold" | "purple";

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
  green: { fill: "var(--color-primary)", dim: "var(--color-primary-dim)" },
  blue: { fill: "var(--color-blue)", dim: "var(--color-blue-dim)" },
  coral: { fill: "var(--color-coral)", dim: "var(--color-coral-dim)" },
  gold: { fill: "var(--color-gold)", dim: "var(--color-gold-dim)" },
  purple: { fill: "var(--color-purple)", dim: "var(--color-purple-dim)" },
};

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

export function DuoProgress({
  value = 0,
  tone = "green",
  height = 10,
  showPct,
  showPercent,
  indeterminate = false,
  label,
  ariaLabel,
  className,
}: DuoProgressProps) {
  const shouldReduceMotion = useReducedMotion();
  const clamped = clamp(value);
  const { fill, dim } = TONE_COLOR[tone];

  return (
    <MantineBoundary>
      <div>
        {label && (
          <p className="mb-2 text-body-sm font-bold text-on-surface">{label}</p>
        )}
        <Progress.Root
          unstyled
          role="progressbar"
          aria-label={ariaLabel || label || "Progres"}
          aria-valuenow={indeterminate ? undefined : clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          className={cn(
            "bg-outline-variant rounded-full border-[1.5px] border-outline relative overflow-hidden",
            className,
          )}
          style={{ height }}
        >
          {indeterminate ? (
            <div
              className="ep-progress-indeterminate absolute top-0 h-full rounded-full"
              style={{
                width: "40%",
                backgroundColor: fill,
                boxShadow: `inset 0 -3px 0 ${dim}`,
              }}
            />
          ) : (
            <Progress.Section
              value={clamped}
              aria-hidden="true"
              className="absolute left-0 top-0 h-full w-full rounded-full origin-left"
              style={{
                width: "100%",
                backgroundColor: fill,
                boxShadow: `inset 0 -3px 0 ${dim}`,
                transform: `scaleX(${clamped / 100})`,
                transition: shouldReduceMotion
                  ? "none"
                  : "transform var(--t-base) var(--ease-press)",
              }}
            />
          )}
          {!indeterminate && (showPct || showPercent) && (
            <span className="absolute inset-0 flex items-center justify-center font-bold text-[11px] text-surface-container-lowest">
              {Math.round(clamped)}%
            </span>
          )}
        </Progress.Root>
      </div>
    </MantineBoundary>
  );
}

export function DuoProgressRing({
  value,
  tone = "green",
  size = 48,
  strokeWidth = 4,
  label,
  className,
}: DuoProgressRingProps) {
  const shouldReduceMotion = useReducedMotion();
  const clamped = clamp(value);
  return (
    <MantineBoundary>
      <RingProgress
        unstyled
        role="progressbar"
        aria-label={label || "Progres"}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        size={size}
        thickness={strokeWidth}
        transitionDuration={shouldReduceMotion ? 0 : 400}
        roundCaps
        rootColor="var(--color-outline-variant)"
        sections={[{ value: clamped, color: TONE_COLOR[tone].fill }]}
        className={className}
        styles={{
          root: { width: size, height: size },
          svg: {
            width: size,
            height: size,
            display: "block",
            transform: "rotate(-90deg)",
          },
          curve: {
            stroke: "var(--curve-color)",
            transition: shouldReduceMotion
              ? "none"
              : "stroke-dasharray 400ms, stroke-dashoffset 400ms",
          },
        }}
      />
    </MantineBoundary>
  );
}
