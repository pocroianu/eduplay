'use client';

import {
  Button as MantineButton,
  MantineContext,
  MantineProvider,
  type ButtonProps as MantineButtonProps,
} from '@mantine/core';
import { useContext, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';

interface AuthButtonProps
  extends Omit<MantineButtonProps, 'children' | 'className' | 'loading' | 'variant'> {
  variant?: 'primary' | 'social';
  isPending?: boolean;
  children: ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function AuthButton({
  variant = 'primary',
  isPending,
  children,
  disabled,
  className,
  type = 'button',
  ...props
}: AuthButtonProps) {
  const isDisabled = disabled || isPending;
  const mantineContext = useContext(MantineContext);

  const rootClassName = cn(
    variant === 'primary'
      ? 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-label text-body font-semibold text-white shadow-soft-sm transition-colors duration-200 hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
      : 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-5 py-3 font-label text-body font-semibold text-on-surface shadow-soft-sm transition-colors duration-200 hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    className,
  );

  const button = (
    <MantineButton
      type={type}
      className={rootClassName}
      disabled={isDisabled}
      aria-busy={isPending || undefined}
      color="purple"
      fullWidth
      variant={variant === 'primary' ? 'filled' : 'default'}
      {...props}
    >
      {children}
    </MantineButton>
  );

  return mantineContext ? button : <MantineProvider>{button}</MantineProvider>;
}
