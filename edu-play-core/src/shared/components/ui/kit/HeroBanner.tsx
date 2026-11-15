"use client";

import { Paper } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";
import type { HTMLAttributes, ReactNode } from "react";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/shared/lib/utils/cn";

import { Icon } from "@/shared/components/ui/Icon";

import type { IconName } from "@/shared/components/ui/Icon.registry";

export type HeroBannerTone = "primary" | "secondary" | "tertiary";

const TONE_CLASS: Record<
  HeroBannerTone,
  { surface: string; onColor: string; accent: string }
> = {
  primary: {
    surface: "bg-primary",

    onColor: "text-on-primary",

    accent: "text-primary-soft",
  },

  secondary: {
    surface: "bg-gold",

    onColor: "text-on-gold",

    accent: "text-gold-deep",
  },

  tertiary: {
    surface: "bg-success-journal",

    onColor: "text-on-tertiary",

    accent: "text-success-soft",
  },
};

export interface HeroBannerProps
  extends Omit<HTMLAttributes<HTMLElement>, "title" | "children"> {
  title: ReactNode;

  subtitle?: ReactNode;

  tone?: HeroBannerTone;

  /** Optional decorative Phosphor icon rendered as illustration on the right. */

  decorativeIcon?: IconName;

  /** Action row rendered below the subtitle — e.g. pills, buttons. */

  children?: ReactNode;

  className?: string;
}

export function HeroBanner({
  title,

  subtitle,

  tone = "primary",

  decorativeIcon,

  children,

  className,

  ...props
}: HeroBannerProps) {
  const reduce = useReducedMotion();

  const palette = TONE_CLASS[tone];

  return (
    <MantineBoundary>
      <Paper
        component="section"
        unstyled
        className={cn(
          "relative overflow-hidden rounded-2xl p-8 md:p-10 min-h-[220px]",

          palette.surface,

          palette.onColor,

          className,
        )}
        {...props}
      >
        <div className="relative z-10 flex flex-col gap-4 max-w-2xl">
          <h1 className="font-headline text-3xl md:text-4xl font-bold leading-tight">
            {title}
          </h1>

          {subtitle ? (
            <p
              className={cn(
                "text-lg md:text-xl leading-relaxed",
                palette.accent,
              )}
            >
              {subtitle}
            </p>
          ) : null}

          {children ? (
            <div className="mt-2 flex flex-wrap gap-3">{children}</div>
          ) : null}
        </div>

        {decorativeIcon ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -bottom-6 opacity-30 hidden sm:block"
            initial={{ y: 0 }}
            animate={reduce ? undefined : { y: [0, -8, 0] }}
            transition={
              reduce
                ? undefined
                : { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }
          >
            <Icon name={decorativeIcon} size={192} />
          </motion.div>
        ) : null}
      </Paper>
    </MantineBoundary>
  );
}
