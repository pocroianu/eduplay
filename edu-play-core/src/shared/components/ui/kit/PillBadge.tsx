"use client";
import { Badge as MantineBadge } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils/cn";

export type PillBadgeTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "error"
  | "neutral";

const TONE_CLASS: Record<PillBadgeTone, string> = {
  primary: "bg-primary-soft text-primary-deep",

  secondary: "bg-gold-soft text-gold-deep",

  tertiary: "bg-primary-soft text-primary-deep",

  error: "bg-error-soft text-coral-deep",

  neutral: "bg-surface-container text-on-surface",
};

export interface PillBadgeProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children" | "className"> {
  children: ReactNode;

  tone?: PillBadgeTone;

  /** Optional leading icon slot (e.g. <Icon />). */

  leading?: ReactNode;

  className?: string;
}

/**

 * @deprecated Use `Pill` for generic labels or `SubjectPill` for subject labels.

 * PillBadge remains exported only for older student pages that have not migrated yet.

 *

 * Token-based pill — always uses `bg-*-container` + `text-on-*-container`

 * token pairs so the label stays accessible in both themes. Body text sits

 * at 18px to satisfy the kid-UI minimum font-size rule (DESIGN.md (Kid mode)).

 */

export function PillBadge({
  children,

  tone = "neutral",

  leading,

  className,

  ...props
}: PillBadgeProps) {
  return (
    <MantineBoundary>
      <MantineBadge
        unstyled
        classNames={{ label: "inline-flex items-center gap-2" }}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-1.5",

          "font-body font-bold",

          "text-[18px] leading-none",

          TONE_CLASS[tone],

          className,
        )}
        {...props}
      >
        {leading}

        {children}
      </MantineBadge>
    </MantineBoundary>
  );
}
