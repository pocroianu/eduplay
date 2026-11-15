import { Container as MantineContainer } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils/cn";

type Width = "narrow" | "default" | "wide" | "full";

type Padding = "none" | "sm" | "md" | "lg";

const WIDTH_CLASS: Record<Width, string> = {
  narrow: "max-w-3xl",

  default: "max-w-5xl",

  wide: "max-w-7xl",

  full: "max-w-none",
};

const PADDING_CLASS: Record<Padding, string> = {
  none: "",

  sm: "px-4 lg:px-6",

  md: "px-6 lg:px-10",

  lg: "px-8 lg:px-14",
};

export interface ContainerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "className" | "children"> {
  children: ReactNode;

  width?: Width;

  padding?: Padding;

  /** Render as an element other than `<div>` (e.g. `section`, `main`). */

  as?: "div" | "section" | "main" | "article" | "header" | "footer";

  className?: string;
}

export function Container({
  children,

  width = "wide",

  padding = "md",

  as: Tag = "div",

  className,

  ...props
}: ContainerProps) {
  return (
    <MantineBoundary>
      <MantineContainer
        component={Tag}
        unstyled
        fluid
        className={cn(
          "mx-auto w-full",
          WIDTH_CLASS[width],
          PADDING_CLASS[padding],
          className,
        )}
        {...props}
      >
        {children}
      </MantineContainer>
    </MantineBoundary>
  );
}
