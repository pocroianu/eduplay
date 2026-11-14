'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';
import { SEESAW_STANDARD_BUTTON_INTERACTION_CLASS } from './seesawInteraction';
const MotionLink = motion.create(Link);
type Mode = 'kid' | 'standard';
type Size = 'sm' | 'md' | 'lg' | 'xl';
type Variant = 'primary' | 'secondary' | 'ghost' | 'icon';
type KidTone = 'lime' | 'sun' | 'sky' | 'cream' | 'ink';
type KidStyle = { face: string; ink: string };
const KID_TONES: Record<KidTone, KidStyle> = {
  lime: {
    face: 'var(--color-primary)',
    ink: 'var(--color-on-primary)',
  },
  sun: {
    face: 'var(--color-gold)',
    ink: 'var(--color-gold-deep)',
  },
  sky: {
    face: 'var(--color-blue)',
    ink: 'var(--color-blue-deep)',
  },
  cream: {
    face: 'var(--color-surface)',
    ink: 'var(--color-on-surface)',
  },
  ink: {
    face: 'var(--color-surface-container)',
    ink: 'var(--color-on-surface)',
  },
};
const KID_SIZES: Record<
  Size,
  { padX: string; padY: string; font: string; minTarget: number }
> = {
  sm: { padX: '1.1rem', padY: '0.6rem', font: '0.8125rem', minTarget: 64 },
  md: { padX: '1.5rem', padY: '0.85rem', font: '0.9375rem', minTarget: 64 },
  lg: { padX: '1.85rem', padY: '1.05rem', font: '1.0625rem', minTarget: 64 },
  xl: { padX: '2.25rem', padY: '1.25rem', font: '1.1875rem', minTarget: 72 },
};
const KID_RADIUS_CLASS: Record<Size, string> = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-2xl',
};
const STANDARD_SIZE_CLASS: Record<Size, string> = {
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
  xl: 'min-h-14 px-6 text-lg',
};
const STANDARD_ICON_SIZE_CLASS: Record<Size, string> = {
  sm: 'h-11 w-11',
  md: 'h-11 w-11',
  lg: 'h-12 w-12',
  xl: 'h-14 w-14',
};
const STANDARD_VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'bg-primary text-on-primary shadow-soft-sm hover:bg-primary-dim',
  secondary:
    'bg-surface-container-lowest text-on-surface shadow-soft-sm hover:bg-primary-soft hover:text-primary-deep',
  ghost:
    'bg-transparent text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
  icon: 'bg-surface-container-lowest text-on-surface-variant shadow-soft-sm hover:bg-primary-soft hover:text-primary',
};
const KID_DEFAULT_TONE: Record<Variant, KidTone> = {
  primary: 'lime',
  secondary: 'sun',
  ghost: 'cream',
  icon: 'cream',
};
/**
 * Event handlers Framer Motion re-types (drag, animation, transition). We
 * omit them from the public API because framer-motion's signatures don't line
 * up with React's DOM event typings and the UI kit doesn't need them.
 */
type MotionConflictingHandlers =
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onDragOver'
  | 'onDragEnter'
  | 'onDragLeave'
  | 'onDragExit'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
  | 'onTransitionEnd';
export interface ButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'children' | MotionConflictingHandlers
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
  mode = 'standard',
  variant = 'primary',
  size = 'md',
  tone,
  href,
  fullWidth = false,
  isPending = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  if (mode === 'kid') {
    return (
      <KidButton
        variant={variant}
        size={size}
        tone={tone ?? KID_DEFAULT_TONE[variant]}
        href={href}
        fullWidth={fullWidth}
        disabled={disabled || isPending}
        className={className}
        {...props}
      >
        {children}
      </KidButton>
    );
  }
  return (
    <StandardButton
      variant={variant}
      size={size}
      href={href}
      fullWidth={fullWidth}
      disabled={disabled || isPending}
      className={className}
      {...props}
    >
      {children}
    </StandardButton>
  );
}
type KidButtonProps = {
  children: ReactNode;
  variant: Variant;
  size: Size;
  tone: KidTone;
  href?: string;
  fullWidth: boolean;
  disabled?: boolean;
  className?: string;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'children' | 'disabled' | MotionConflictingHandlers
>;
function KidButton({
  children,
  size,
  tone,
  href,
  fullWidth,
  disabled,
  className,
  ...props
}: KidButtonProps) {
  const toneStyle = KID_TONES[tone];
  const dims = KID_SIZES[size];
  const motionVariants = {
    rest: {
      y: 0,
      transition: { duration: 0.14, ease: 'easeOut' as const },
    },
    hover: {
      y: -1,
      transition: { duration: 0.14, ease: 'easeOut' as const },
    },
    tap: {
      y: 1,
      transition: { duration: 0.08, ease: 'easeOut' as const },
    },
  };
  const inner = (
    <span
      className="flex items-center justify-center gap-2 font-headline font-bold uppercase whitespace-nowrap"
      style={{
        paddingLeft: dims.padX,
        paddingRight: dims.padX,
        paddingTop: dims.padY,
        paddingBottom: dims.padY,
        fontSize: dims.font,
        letterSpacing: '0.04em',
        color: toneStyle.ink,
      }}
    >
      {children}
    </span>
  );
  const motionStyle = {
    backgroundColor: toneStyle.face,
    color: toneStyle.ink,
    display: fullWidth ? 'flex' : 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: `${dims.minTarget}px`,
    minWidth: `${dims.minTarget}px`,
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.5 : 1,
  };
  if (href) {
    return (
      <MotionLink
        href={href}
        aria-disabled={disabled || undefined}
        initial="rest"
        animate="rest"
        whileHover={disabled ? 'rest' : 'hover'}
        whileTap={disabled ? 'rest' : 'tap'}
        variants={motionVariants}
        style={{ ...motionStyle, pointerEvents: disabled ? 'none' : undefined }}
        className={cn(
          'border border-outline-variant shadow-soft-sm transition-[box-shadow,transform,opacity] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
          KID_RADIUS_CLASS[size],
          className,
        )}
      >
        {inner}
      </MotionLink>
    );
  }
  return (
    <motion.button
      type="button"
      disabled={disabled}
      initial="rest"
      animate="rest"
      whileHover={disabled ? 'rest' : 'hover'}
      whileTap={disabled ? 'rest' : 'tap'}
      variants={motionVariants}
      style={motionStyle}
      className={cn(
        'border border-outline-variant shadow-soft-sm transition-[box-shadow,transform,opacity] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        KID_RADIUS_CLASS[size],
        className,
      )}
      {...props}
    >
      {inner}
    </motion.button>
  );
}
type StandardButtonProps = {
  children: ReactNode;
  variant: Variant;
  size: Size;
  href?: string;
  fullWidth: boolean;
  disabled?: boolean;
  className?: string;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'children' | 'disabled' | MotionConflictingHandlers
>;
function StandardButton({
  children,
  variant,
  size,
  href,
  fullWidth,
  disabled,
  className,
  ...props
}: StandardButtonProps) {
  const base = `inline-flex items-center justify-center gap-2 rounded-md font-headline font-semibold disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${SEESAW_STANDARD_BUTTON_INTERACTION_CLASS}`;
  const sizing =
    variant === 'icon'
      ? STANDARD_ICON_SIZE_CLASS[size]
      : STANDARD_SIZE_CLASS[size];
  const classes = cn(
    base,
    sizing,
    STANDARD_VARIANT_CLASS[variant],
    fullWidth && 'w-full',
    disabled && 'cursor-not-allowed',
    className,
  );
  if (href) {
    // Match `KidButton`'s link branch: when disabled, `<Link>` only sets
    // `aria-disabled`, which screen readers honour but mouse/touch clicks do
    // not. Block pointer events and remove from the tab order so a disabled
    // CTA cannot navigate (e.g. a teacher clicking Preview mid-save).
    return (
      <Link
        href={href}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        style={{ pointerEvents: disabled ? 'none' : undefined }}
        className={classes}
      >
        {children}
      </Link>
    );
  }
  return (
    <motion.button
      type="button"
      disabled={disabled}
      transition={{ duration: 0.15 }}
      className={classes}
      {...props}
    >
      {children}
    </motion.button>
  );
}
