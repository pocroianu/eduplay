"use client";
import { Badge as MantineBadge } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils/cn";

type Mode = "kid" | "standard";

type Tone = "neutral" | "primary" | "success" | "warning" | "info" | "danger";

type Size = "sm" | "md";

const KID_TONE_STYLE: Record<Tone, { bg: string; text: string }> = {
  neutral: {
    bg: "var(--color-surface)",

    text: "var(--color-on-surface)",
  },

  primary: {
    bg: "var(--color-blue)",

    text: "var(--color-on-surface)",
  },

  success: {
    bg: "var(--color-primary)",

    text: "var(--color-surface)",
  },

  warning: {
    bg: "var(--color-gold)",

    text: "var(--color-on-surface)",
  },

  info: {
    bg: "var(--color-blue)",

    text: "var(--color-on-surface)",
  },

  danger: {
    bg: "var(--color-coral)",

    text: "var(--color-on-coral)",
  },
};

const STANDARD_TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-surface-container text-on-surface-variant",

  primary: "bg-primary-soft text-primary-deep",

  success: "bg-success-soft text-success",

  warning: "bg-gold-soft text-gold-deep",

  info: "bg-blue-soft text-blue-deep",

  danger: "bg-error-soft text-error",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "px-2 py-0.5 text-[10px]",

  md: "px-2.5 py-1 text-xs",
};

export interface BadgeProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "className" | "children"> {
  children: ReactNode;

  mode?: Mode;

  tone?: Tone;

  size?: Size;

  className?: string;
}

export function Badge({
  children,

  mode = "standard",

  tone = "neutral",

  size = "md",

  className,

  style,

  ...props
}: BadgeProps) {
  if (mode === "kid") {
    const toneStyle = KID_TONE_STYLE[tone];

    return (
      <MantineBoundary>
        <MantineBadge
          unstyled
          classNames={{ label: "inline-flex items-center gap-1" }}
          className={cn(
            "inline-flex items-center gap-1 rounded-full font-headline font-bold uppercase tracking-wider",

            SIZE_CLASS[size],

            className,
          )}
          style={{
            backgroundColor: toneStyle.bg,

            color: toneStyle.text,

            border: "2px solid var(--color-on-surface)",

            ...style,
          }}
          {...props}
        >
          {children}
        </MantineBadge>
      </MantineBoundary>
    );
  }

  return (
    <MantineBoundary>
      <MantineBadge
        unstyled
        classNames={{ label: "inline-flex items-center gap-1" }}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm font-body font-semibold uppercase tracking-wide",

          SIZE_CLASS[size],

          STANDARD_TONE_CLASS[tone],

          className,
        )}
        style={style}
        {...props}
      >
        {children}
      </MantineBadge>
    </MantineBoundary>
  );
}
