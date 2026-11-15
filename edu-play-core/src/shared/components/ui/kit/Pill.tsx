"use client";
import { Badge as MantineBadge } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils/cn";

type Mode = "kid" | "standard";

type Tone =
  | "neutral"
  | "lime"
  | "sun"
  | "sky"
  | "cream"
  | "ink"
  | "coral"
  | "purple"
  | "pink";

const KID_TONE_STYLE: Record<Tone, { bg: string; text: string }> = {
  neutral: {
    bg: "var(--color-surface-container-lowest)",

    text: "var(--color-on-surface)",
  },

  lime: {
    bg: "var(--color-primary)",

    text: "var(--color-surface)",
  },

  sun: {
    bg: "var(--color-gold)",

    text: "var(--color-gold-deep)",
  },

  sky: {
    bg: "var(--color-blue)",

    text: "var(--color-surface)",
  },

  cream: {
    bg: "var(--color-surface)",

    text: "var(--color-on-surface)",
  },

  ink: {
    bg: "var(--color-on-surface)",

    text: "var(--color-surface)",
  },

  coral: {
    bg: "var(--color-coral)",

    text: "var(--color-surface)",
  },

  purple: {
    bg: "var(--color-purple)",

    text: "var(--color-surface)",
  },

  pink: {
    bg: "var(--color-pink)",

    text: "var(--color-pink-deep)",
  },
};

const STANDARD_TONE_CLASS: Record<Tone, string> = {
  neutral:
    "bg-surface-container-lowest text-on-surface border border-outline-variant",

  lime: "bg-primary-soft text-primary-deep",

  sun: "bg-gold-soft text-gold-deep",

  sky: "bg-blue-soft text-blue-deep",

  cream: "bg-surface text-on-surface",

  ink: "bg-class-header text-white",

  coral: "bg-coral-soft text-coral-deep",

  purple: "bg-purple-soft text-purple-deep",

  pink: "bg-pink-soft text-pink-deep",
};

export interface PillProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "className" | "children"> {
  children: ReactNode;

  /** Optional leading slot — typically an `<Icon>`, sized by the caller. */

  leading?: ReactNode;

  /** Optional trailing slot. */

  trailing?: ReactNode;

  mode?: Mode;

  tone?: Tone;

  /** kid-mode only: add the chunky ink border. Default true. */

  outlined?: boolean;

  className?: string;
}

export function Pill({
  children,

  leading,

  trailing,

  mode = "standard",

  tone = "neutral",

  outlined = true,

  className,

  style,

  ...props
}: PillProps) {
  if (mode === "kid") {
    const toneStyle = KID_TONE_STYLE[tone];

    return (
      <MantineBoundary>
        <MantineBadge
          unstyled
          classNames={{ label: "inline-flex items-center gap-1.5" }}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-body text-xs font-bold",

            className,
          )}
          style={{
            backgroundColor: toneStyle.bg,

            color: toneStyle.text,

            border: outlined ? "2px solid var(--color-on-surface)" : undefined,

            ...style,
          }}
          {...props}
        >
          {leading}

          {children}

          {trailing}
        </MantineBadge>
      </MantineBoundary>
    );
  }

  return (
    <MantineBoundary>
      <MantineBadge
        unstyled
        classNames={{ label: "inline-flex items-center gap-1.5" }}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold",

          STANDARD_TONE_CLASS[tone],

          className,
        )}
        style={style}
        {...props}
      >
        {leading}

        {children}

        {trailing}
      </MantineBadge>
    </MantineBoundary>
  );
}
