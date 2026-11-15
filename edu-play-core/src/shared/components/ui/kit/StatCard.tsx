"use client";

import { Paper, type PaperProps } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";
import type { ComponentType, HTMLAttributes, ReactNode } from "react";

import { motion, useReducedMotion } from "framer-motion";

import { Icon } from "@/shared/components/ui/Icon";

import type { IconName } from "@/shared/components/ui/Icon.registry";

import { cn } from "@/shared/lib/utils/cn";

const MotionPaper = motion.create(
  Paper as ComponentType<PaperProps & HTMLAttributes<HTMLDivElement>>,
);

type Variant = "standard" | "kid";

type Tone = "primary" | "tertiary" | "secondary" | "warning";

/** Handlers whose React DOM signatures conflict with framer-motion's. */

type MotionConflictingHandlers =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragOver"
  | "onDragEnter"
  | "onDragLeave"
  | "onDragExit"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onTransitionEnd";

type DivProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "children" | MotionConflictingHandlers
>;

/**

 * Semantic token names for each tone. The chip background and icon accent stay

 * traceable to `src/app/globals.css` — no raw hex here.

 */

const TONE_TOKEN: Record<Tone, { chipBg: string; accent: string }> = {
  primary: { chipBg: "bg-primary/10", accent: "text-primary" },

  tertiary: { chipBg: "bg-primary/10", accent: "text-primary" },

  secondary: { chipBg: "bg-gold/10", accent: "text-gold" },

  warning: { chipBg: "bg-coral/10", accent: "text-coral" },
};

export interface StatCardProps extends DivProps {
  label: ReactNode;

  value: ReactNode;

  /** Material Symbol name. Rendered inside the trailing 52x52 chip. */

  icon: IconName;

  tone?: Tone;

  variant?: Variant;

  className?: string;
}

/**

 * @deprecated Use `StatBlock` for new compact metrics. StatCard remains for

 * transitional dashboard consumers only.

 */

export function StatCard({
  label,

  value,

  icon,

  tone = "primary",

  variant = "standard",

  className,

  ...props
}: StatCardProps) {
  if (variant === "kid") {
    return (
      <MantineBoundary>
        <KidStatCard
          label={label}
          value={value}
          icon={icon}
          tone={tone}
          className={className}
          {...props}
        />
      </MantineBoundary>
    );
  }

  return (
    <MantineBoundary>
      <OverviewStatCard
        label={label}
        value={value}
        icon={icon}
        tone={tone}
        className={className}
        {...props}
      />
    </MantineBoundary>
  );
}

type InnerProps = {
  label: ReactNode;

  value: ReactNode;

  icon: IconName;

  tone: Tone;

  className?: string;
} & DivProps;

function OverviewStatCard({
  label,
  value,
  icon,
  tone,
  className,
  ...props
}: InnerProps) {
  const tokens = TONE_TOKEN[tone];

  return (
    <Paper
      unstyled
      className={cn(
        "min-h-[146px] rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-soft-sm",

        "flex items-center justify-between gap-4",

        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-2 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </p>

        <p className="text-[34px] font-bold leading-none text-on-surface font-headline">
          {value}
        </p>
      </div>

      <div
        className={cn(
          "h-[52px] w-[52px] shrink-0 rounded-2xl flex items-center justify-center",

          tokens.chipBg,

          tokens.accent,
        )}
        aria-hidden="true"
      >
        <Icon name={icon} size={28} />
      </div>
    </Paper>
  );
}

function KidStatCard({
  label,
  value,
  icon,
  tone,
  className,
  ...props
}: InnerProps) {
  const reduceMotion = useReducedMotion();

  const tokens = TONE_TOKEN[tone];

  return (
    <MotionPaper
      unstyled
      initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "min-h-[146px] rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-soft flex items-center justify-between gap-4",

        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-2 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </p>

        <p className="text-[34px] font-bold leading-none font-headline text-on-surface">
          {value}
        </p>
      </div>

      <div
        className={cn(
          "h-[52px] w-[52px] shrink-0 rounded-2xl flex items-center justify-center",

          tokens.chipBg,

          tokens.accent,
        )}
        aria-hidden="true"
      >
        <Icon name={icon} size={28} />
      </div>
    </MotionPaper>
  );
}
