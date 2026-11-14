'use client';

import Link from 'next/link';
import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/utils/cn';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { transitions } from '@/config/animations';

const MotionLink = motion.create(Link);

type Variant = 'green' | 'gold' | 'blue' | 'coral' | 'purple' | 'pink' | 'ghost' | 'ink';
type Size = 'sm' | 'md' | 'lg';

interface VariantStyle {
  bg: string;
  text: string;
}

const VARIANT_STYLES: Record<Variant, VariantStyle> = {
  green: { bg: 'bg-primary', text: 'text-white' },
  gold: { bg: 'bg-gold', text: 'text-on-gold' },
  blue: { bg: 'bg-blue', text: 'text-white' },
  coral: { bg: 'bg-coral', text: 'text-white' },
  purple: { bg: 'bg-purple', text: 'text-white' },
  pink: { bg: 'bg-pink', text: 'text-ink' },
  ghost: { bg: 'bg-white', text: 'text-ink' },
  ink: { bg: 'bg-surface-container', text: 'text-ink' },
};

interface SizeConfig {
  padding: string;
  fontSize: string;
  minSize: string;
  radius: string;
  iconSize: number;
}

const SIZE_CONFIG: Record<Size, SizeConfig> = {
  sm: { padding: 'py-2 px-4', fontSize: 'text-body-sm', minSize: 'min-h-11 min-w-11', radius: 'rounded-md', iconSize: 16 },
  md: { padding: 'py-3 px-[22px]', fontSize: 'text-body', minSize: 'min-h-11 min-w-11', radius: 'rounded-md', iconSize: 17 },
  lg: { padding: 'py-4 px-7', fontSize: 'text-title', minSize: 'min-h-16 min-w-16', radius: 'rounded-lg', iconSize: 21 },
};

type ConflictingMotionProps =
  | 'className'
  | 'children'
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
  | 'onTransitionEnd';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  full?: boolean;
  children: ReactNode;
  className?: string;
}

type ButtonOnlyProps = CommonProps & {
  href?: undefined;
  loading?: boolean;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  ConflictingMotionProps | keyof CommonProps | 'loading'
>;

type LinkOnlyProps = CommonProps & {
  href: string;
} & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  ConflictingMotionProps | keyof CommonProps | 'href'
>;

export type ChunkyButtonProps = ButtonOnlyProps | LinkOnlyProps;


export function ChunkyButton(props: ChunkyButtonProps) {
  if (props.href !== undefined) {
    return <ChunkyLink {...props} />;
  }
  return <ChunkyNativeButton {...props} />;
}

function ChunkyNativeButton({
  variant = 'green',
  size = 'md',
  icon,
  iconRight,
  full = false,
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonOnlyProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeConfig = SIZE_CONFIG[size];
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type="button"
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold tracking-[0.01em] select-none shadow-soft-sm',
        'outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        variantStyle.bg,
        variantStyle.text,
        sizeConfig.padding,
        sizeConfig.fontSize,
        sizeConfig.minSize,
        sizeConfig.radius,
        full && 'w-full',
        isDisabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      initial={false}
      animate={{ y: 0, boxShadow: 'var(--shadow-soft-sm)' }}
      whileTap={isDisabled ? undefined : { y: 1, boxShadow: 'var(--shadow-soft)' }}
      transition={transitions.press}
      {...props}
    >
      <ChunkyContent icon={icon} iconRight={iconRight} loading={loading} iconSize={sizeConfig.iconSize}>
        {children}
      </ChunkyContent>
    </motion.button>
  );
}

function ChunkyLink({
  href,
  variant = 'green',
  size = 'md',
  icon,
  iconRight,
  full = false,
  children,
  className,
  ...props
}: LinkOnlyProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeConfig = SIZE_CONFIG[size];
  return (
    <MotionLink
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold tracking-[0.01em] select-none shadow-soft-sm',
        'outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        variantStyle.bg,
        variantStyle.text,
        sizeConfig.padding,
        sizeConfig.fontSize,
        sizeConfig.minSize,
        sizeConfig.radius,
        full && 'w-full',
        className,
      )}
      initial={false}
      animate={{ y: 0, boxShadow: 'var(--shadow-soft-sm)' }}
      whileTap={{ y: 1, boxShadow: 'var(--shadow-soft)' }}
      transition={transitions.press}
      {...props}
    >
      <ChunkyContent icon={icon} iconRight={iconRight} loading={false} iconSize={sizeConfig.iconSize}>
        {children}
      </ChunkyContent>
    </MotionLink>
  );
}

function ChunkyContent({
  icon,
  iconRight,
  loading,
  iconSize,
  children,
}: {
  icon?: IconName;
  iconRight?: IconName;
  loading: boolean;
  iconSize: number;
  children: ReactNode;
}) {
  return (
    <>
      {loading ? (
        <span className="flex shrink-0 items-center animate-spin">
          <Icon name="CircleNotch" size={iconSize} />
        </span>
      ) : icon ? (
        <span className="flex shrink-0 items-center">
          <Icon name={icon} size={iconSize} weight="bold" />
        </span>
      ) : null}
      {children}
      {!loading && iconRight && (
        <span className="flex shrink-0 items-center">
          <Icon name={iconRight} size={iconSize} weight="bold" />
        </span>
      )}
    </>
  );
}
