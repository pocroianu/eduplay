"use client";
import { UnstyledButton } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";
import Link from "next/link";

import type { AnchorHTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils/cn";

import {
  HOVER_HIGHLIGHT_CLASS,
  HOVER_HIGHLIGHT_STYLE,
  SURFACE_INTERACTION_CLASS,
} from "./interactionTokens";

export interface InteractiveSurfaceProps
  extends Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "className" | "children" | "href"
  > {
  href: string;

  children: ReactNode;

  /** Surface layout and visual treatment. The component owns interaction chrome only. */

  className?: string;

  /** Token-backed highlight wash. Use a light wash on saturated surfaces. */

  highlightClassName?: string;
}

/**

 * EduPlay clickable surface: no lift, only a soft hover/focus wash.
 * Use for card-like links and large dashboard affordances.

 */

export function InteractiveSurface({
  href,

  children,

  className,

  highlightClassName = "bg-current",

  ...props
}: InteractiveSurfaceProps) {
  return (
    <MantineBoundary>
      <UnstyledButton
        component={Link}
        href={href}
        className={cn(
          SURFACE_INTERACTION_CLASS,

          className,
        )}
        {...props}
      >
        {children}

        <span
          data-hover-highlight
          aria-hidden="true"
          className={cn(HOVER_HIGHLIGHT_CLASS, highlightClassName)}
          style={HOVER_HIGHLIGHT_STYLE}
        />
      </UnstyledButton>
    </MantineBoundary>
  );
}
