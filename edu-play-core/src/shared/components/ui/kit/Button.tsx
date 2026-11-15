"use client";
import Link from "next/link";
import { Button as MantineButton } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/shared/lib/utils/cn";
import { SEESAW_STANDARD_BUTTON_INTERACTION_CLASS } from "./seesawInteraction";
type Mode = "kid" | "standard";
type Size = "sm" | "md" | "lg" | "xl";
type Variant = "primary" | "secondary" | "ghost" | "icon";
type KidTone = "lime" | "sun" | "sky" | "cream" | "ink";
type KidStyle = { face: string; ink: string };
const KID_TONES: Record<KidTone, KidStyle> = {
  lime: {
    face: "var(--color-primary)",
    ink: "var(--color-on-primary)",
  },
  sun: {
    face: "var(--color-gold)",
    ink: "var(--color-gold-deep)",
  },
  sky: {
    face: "var(--color-blue)",
    ink: "var(--color-blue-deep)",
  },
  cream: {
    face: "var(--color-surface)",
    ink: "var(--color-on-surface)",
  },
  ink: {
    face: "var(--color-surface-container)",
    ink: "var(--color-on-surface)",
  },
};
const KID_SIZES: Record<
  Size,
  { padX: string; padY: string; font: string; minTarget: number }
> = {
  sm: { padX: "1.1rem", padY: "0.6rem", font: "0.8125rem", minTarget: 64 },
  md: { padX: "1.5rem", padY: "0.85rem", font: "0.9375rem", minTarget: 64 },
  lg: { padX: "1.85rem", padY: "1.05rem", font: "1.0625rem", minTarget: 64 },
  xl: { padX: "2.25rem", padY: "1.25rem", font: "1.1875rem", minTarget: 72 },
};
const KID_RADIUS_CLASS: Record<Size, string> = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-2xl",
};
const STANDARD_SIZE_CLASS: Record<Size, string> = {
  sm: "min-h-11 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
  xl: "min-h-14 px-6 text-lg",
};
const STANDARD_ICON_SIZE_CLASS: Record<Size, string> = {
  sm: "h-11 w-11",
  md: "h-11 w-11",
  lg: "h-12 w-12",
  xl: "h-14 w-14",
};
const STANDARD_VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-soft-sm hover:bg-primary-dim",
  secondary:
    "bg-surface-container-lowest text-on-surface shadow-soft-sm hover:bg-primary-soft hover:text-primary-deep",
  ghost:
    "bg-transparent text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
  icon: "bg-surface-container-lowest text-on-surface-variant shadow-soft-sm hover:bg-primary-soft hover:text-primary",
};
const KID_DEFAULT_TONE: Record<Variant, KidTone> = {
  primary: "lime",
  secondary: "sun",
  ghost: "cream",
  icon: "cream",
};
/**
 * Event handlers Framer Motion re-types (drag, animation, transition). We
 * omit them from the public API because framer-motion's signatures don't line
 * up with React's DOM event typings and the UI kit doesn't need them.
 */
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
export interface ButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "children" | MotionConflictingHandlers
  > {
  children: ReactNode;
  mode?: Mode;
  variant?: Variant;
  size?: Size;
  /** Kid-mode colour family. Ignored when mode='standard'. Defaults per variant. */
  tone?: KidTone;
  /** Render as a Next.js <Link> instead of a <button>. */
  href?: string;
  /** Expand to 100% width of the parent. */
  fullWidth?: boolean;
  /** Loading state — disables interaction but does not change layout. */
  isPending?: boolean;
  className?: string;
}
export function Button({
  children,
  mode = "standard",
  variant = "primary",
  size = "md",
  tone,
  href,
  fullWidth = false,
  isPending = false,
  className,
  disabled,
  style,
  onClick,
  tabIndex,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || isPending);
  const isKid = mode === "kid";
  const toneStyle = KID_TONES[tone ?? KID_DEFAULT_TONE[variant]];
  const dims = KID_SIZES[size];
  const classes = cn(
    "inline-flex items-center justify-center gap-2 font-headline font-semibold disabled:opacity-50",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
    SEESAW_STANDARD_BUTTON_INTERACTION_CLASS,
    isKid
      ? cn(
          "border border-outline-variant shadow-soft-sm",
          KID_RADIUS_CLASS[size],
        )
      : cn(
          "rounded-md",
          variant === "icon"
            ? STANDARD_ICON_SIZE_CLASS[size]
            : STANDARD_SIZE_CLASS[size],
          STANDARD_VARIANT_CLASS[variant],
        ),
    fullWidth && "w-full",
    isDisabled && "cursor-not-allowed",
    className,
  );
  const controlStyle = {
    ...(isKid
      ? {
          backgroundColor: toneStyle.face,
          color: toneStyle.ink,
          minHeight: dims.minTarget,
          minWidth: dims.minTarget,
          paddingInline: dims.padX,
          paddingBlock: dims.padY,
          fontSize: dims.font,
        }
      : {}),
    ...style,
  };
  const content = href ? (
    <MantineButton
      {...(props as unknown as AnchorHTMLAttributes<HTMLAnchorElement>)}
      component={Link}
      href={href}
      unstyled
      className={classes}
      classNames={{
        inner: "inline-flex items-center justify-center gap-2",
        label: "inline-flex items-center gap-2",
      }}
      aria-disabled={isDisabled || undefined}
      aria-busy={isPending || undefined}
      tabIndex={isDisabled ? -1 : tabIndex}
      style={{
        ...controlStyle,
        pointerEvents: isDisabled ? "none" : undefined,
      }}
      onClick={(event) => {
        if (isDisabled) {
          event.preventDefault();
          return;
        }
        // The public click handler is button-typed for compatibility.
        onClick?.(
          event as unknown as Parameters<NonNullable<typeof onClick>>[0],
        );
      }}
    >
      {children}
    </MantineButton>
  ) : (
    <MantineButton
      unstyled
      type="button"
      className={classes}
      classNames={{
        inner: "inline-flex items-center justify-center gap-2",
        label: "inline-flex items-center gap-2",
      }}
      disabled={isDisabled}
      aria-busy={isPending || undefined}
      tabIndex={tabIndex}
      style={controlStyle}
      onClick={onClick}
      {...props}
    >
      {children}
    </MantineButton>
  );
  return <MantineBoundary>{content}</MantineBoundary>;
}
