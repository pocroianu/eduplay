"use client";

import { Paper } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils/cn";

import { Icon } from "@/shared/components/ui/Icon";

import type { IconName } from "@/shared/components/ui/Icon.registry";

export type StatBlockVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "warning"
  | "error";

const VARIANT_CLASS: Record<
  StatBlockVariant,
  { chip: string; iconClass: string }
> = {
  primary: {
    chip: "bg-primary-soft",

    iconClass: "text-primary-deep",
  },

  secondary: {
    chip: "bg-gold-soft",

    iconClass: "text-gold-deep",
  },

  tertiary: {
    chip: "bg-primary-soft",

    iconClass: "text-primary-deep",
  },

  warning: {
    chip: "bg-gold-soft",

    iconClass: "text-gold-deep",
  },

  error: {
    chip: "bg-error-soft",

    iconClass: "text-coral-deep",
  },
};

export interface StatBlockProps {
  label: ReactNode;

  value: ReactNode;

  icon: IconName;

  variant?: StatBlockVariant;

  /** Disables hover animation for users who prefer reduced motion. */

  reducedMotion?: boolean;

  className?: string;
}

/**

 * StatBlock — compact standard-mode metric tile.

 *

 * Uses a white card, soft elevation, and a flat token-backed icon chip so

 * dashboard metrics match the EduPlay visual system.
 */

export function StatBlock({
  label,

  value,

  icon,

  variant = "primary",

  className,
}: StatBlockProps) {
  const palette = VARIANT_CLASS[variant];

  return (
    <MantineBoundary>
      <Paper
        unstyled
        className={cn(
          "flex items-center justify-between gap-4",

          "rounded-lg bg-surface-container-lowest p-6",

          "shadow-soft-sm transition-shadow hover:shadow-soft",

          "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary",

          className,
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="font-body text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            {label}
          </p>

          <p className="font-headline text-3xl font-bold leading-tight text-on-background">
            {value}
          </p>
        </div>

        <div
          className={cn(
            "shrink-0 rounded-lg p-3 shadow-soft-sm",

            palette.chip,
          )}
          aria-hidden="true"
        >
          <Icon
            name={icon}
            className={palette.iconClass}
            size={28}
            weight="fill"
          />
        </div>
      </Paper>
    </MantineBoundary>
  );
}
