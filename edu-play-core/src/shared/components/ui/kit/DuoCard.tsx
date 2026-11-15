"use client";

import { createElement } from "react";

import { Paper } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";

import type {
  AnchorHTMLAttributes,
  CSSProperties,
  ElementType,
  HTMLAttributes,
  ReactNode,
} from "react";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/shared/lib/utils/cn";

type CardElement = "div" | "article" | "section" | "a";

type Variant = "plain" | "chunky" | "hero" | "inset";

type AccentTone = "green" | "gold" | "blue" | "coral" | "purple" | "pink";

type Tone = "neutral" | AccentTone;

const HERO_BACKGROUND: Record<AccentTone, string> = {
  green: "var(--color-success-journal)",

  gold: "var(--color-gold)",

  blue: "var(--color-blue)",

  coral: "var(--color-coral)",

  purple: "var(--color-purple)",

  pink: "var(--color-pink)",
};

const TONE_WASH: Record<AccentTone, string> = {
  green: "var(--color-primary-wash)",

  gold: "var(--color-gold-wash)",

  blue: "var(--color-blue-wash)",

  coral: "var(--color-coral-wash)",

  purple: "var(--color-purple-wash)",

  pink: "var(--color-pink-wash)",
};

const MOTION_ELEMENTS = {
  div: motion.div,

  article: motion.article,

  section: motion.section,

  a: motion.a,
} as const;

const MantineSurface = Paper as ElementType;

export interface DuoCardProps
  extends Omit<HTMLAttributes<HTMLElement>, "className" | "children">,
    Pick<
      AnchorHTMLAttributes<HTMLAnchorElement>,
      "download" | "href" | "hrefLang" | "referrerPolicy" | "rel" | "target"
    > {
  variant?: Variant;

  interactive?: boolean;

  tone?: Tone;

  as?: CardElement;

  children: ReactNode;

  className?: string;
}

export function DuoCard({
  variant = "plain",

  interactive = false,

  tone,

  as = "div",

  children,

  className,

  style,

  ...props
}: DuoCardProps) {
  const shouldReduceMotion = useReducedMotion();

  const resolvedTone = tone === "neutral" ? undefined : tone;

  const Element = (interactive ? MOTION_ELEMENTS[as] : as) as ElementType;

  const motionProps =
    interactive && !shouldReduceMotion
      ? {
          whileHover: { boxShadow: "var(--shadow-soft)" },

          transition: { duration: 0.2 },
        }
      : {};

  const linkStyle: CSSProperties | undefined =
    as === "a" ? { color: "inherit", textDecoration: "none" } : undefined;

  if (variant === "hero") {
    const heroTone = resolvedTone ?? "green";

    const background = HERO_BACKGROUND[heroTone];

    return createElement(
      MantineBoundary,
      null,
      createElement(
        MantineSurface,

        {
          component: Element,
          unstyled: true,

          className: cn(
            "rounded-xl p-6 text-white shadow-soft",

            interactive && "cursor-pointer",

            className,
          ),

          style: {
            background,

            boxShadow: "var(--shadow-soft)",

            ...linkStyle,

            ...style,
          },

          ...motionProps,

          ...props,
        },

        children,
      ),
    );
  }

  if (variant === "inset") {
    return createElement(
      MantineBoundary,
      null,
      createElement(
        MantineSurface,

        {
          component: Element,
          unstyled: true,

          className: cn(
            "rounded-lg bg-surface-container p-5",

            interactive && "cursor-pointer",

            className,
          ),

          style: {
            boxShadow: "var(--shadow-inner-soft)",

            ...linkStyle,

            ...style,
          },

          ...motionProps,

          ...props,
        },

        children,
      ),
    );
  }

  const toneStyle =
    resolvedTone && variant === "plain"
      ? {
          backgroundColor: TONE_WASH[resolvedTone],
        }
      : undefined;

  return createElement(
    MantineBoundary,
    null,
    createElement(
      MantineSurface,

      {
        component: Element,
        unstyled: true,

        className: cn(
          "rounded-lg bg-surface-container-lowest p-5 shadow-soft-sm",

          variant === "chunky" && "rounded-xl p-6 shadow-soft",

          interactive && "cursor-pointer",

          className,
        ),

        style: { ...toneStyle, ...linkStyle, ...style },

        ...motionProps,

        ...props,
      },

      children,
    ),
  );
}
