"use client";

import { isValidElement, type ReactElement, type ReactNode } from "react";
import { Tooltip } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";
import { cn } from "@/shared/lib/utils/cn";

export interface DuoTooltipProps {
  content: ReactNode;
  placement?: "top" | "bottom";
  delay?: number;
  /** The trigger should accept a ref and aria attributes. */
  children: ReactNode;
  className?: string;
}

export function DuoTooltip({
  content,
  placement = "top",
  delay = 300,
  children,
  className,
}: DuoTooltipProps) {
  // Non-element children (plain text) are not focusable; make the wrapper a
  // tab stop so keyboard users can reveal the tooltip too.
  const target = isValidElement(children) ? (
    (children as ReactElement)
  ) : (
    <span tabIndex={0}>{children}</span>
  );
  return (
    <MantineBoundary>
      <Tooltip
        label={content}
        position={placement}
        openDelay={delay}
        events={{ hover: true, focus: true, touch: true }}
        className={cn(
          "bg-surface-container-lowest shadow-popover text-on-surface",
          className,
        )}
        multiline
        maw={320}
      >
        {target}
      </Tooltip>
    </MantineBoundary>
  );
}
