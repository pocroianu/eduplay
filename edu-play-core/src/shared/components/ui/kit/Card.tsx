'use client';

import { useContext, type HTMLAttributes, type ReactNode } from 'react';
import {
  Box,
  Card as MantineCard,
  MantineContext,
  MantineProvider,
} from '@mantine/core';
import { cn } from '@/shared/lib/utils/cn';

type Mode = 'kid' | 'standard';
type Tone = 'surface' | 'cream' | 'ink' | 'lime' | 'sun' | 'sky' | 'glass';
type Padding = 'none' | 'sm' | 'md' | 'lg';

const PADDING_SIZE: Record<Padding, number> = {
  none: 0,
  sm: 16,
  md: 24,
  lg: 32,
};

const KID_TONE_STYLE: Record<
  Tone,
  { bg: string; text: string; chrome: string }
> = {
  surface: {
    bg: 'var(--color-surface)',
    text: 'var(--color-on-surface)',
    chrome: 'var(--color-outline-variant)',
  },
  cream: {
    bg: 'var(--color-surface)',
    text: 'var(--color-on-surface)',
    chrome: 'var(--color-outline-variant)',
  },
  ink: {
    bg: 'var(--color-surface-container)',
    text: 'var(--color-on-surface)',
    chrome: 'var(--color-outline-variant)',
  },
  lime: {
    bg: 'var(--color-primary)',
    text: 'var(--color-surface)',
    chrome: 'var(--color-primary-dim)',
  },
  sun: {
    bg: 'var(--color-gold)',
    text: 'var(--color-on-surface)',
    chrome: 'var(--color-gold-dim)',
  },
  sky: {
    bg: 'var(--color-blue)',
    text: 'var(--color-on-surface)',
    chrome: 'var(--color-blue-dim)',
  },
  glass: {
    bg: 'var(--color-surface-container-lowest)',
    text: 'var(--color-on-surface)',
    chrome: 'var(--color-outline-variant)',
  },
};

const STANDARD_TONE_STYLE: Record<
  Tone,
  { bg: string; text: string; chrome: string }
> = {
  surface: {
    bg: 'var(--color-surface-container-lowest)',
    text: 'var(--color-on-surface)',
    chrome: 'var(--color-outline)',
  },
  cream: {
    bg: 'var(--color-surface)',
    text: 'var(--color-on-surface)',
    chrome: 'var(--color-outline)',
  },
  ink: {
    bg: 'var(--color-class-header)',
    text: 'white',
    chrome: 'var(--color-class-header)',
  },
  lime: {
    bg: 'var(--color-primary-soft)',
    text: 'var(--color-primary-deep)',
    chrome: 'var(--color-outline)',
  },
  sun: {
    bg: 'var(--color-gold-soft)',
    text: 'var(--color-gold-deep)',
    chrome: 'var(--color-outline)',
  },
  sky: {
    bg: 'var(--color-blue-wash)',
    text: 'var(--color-blue-deep)',
    chrome: 'var(--color-outline)',
  },
  glass: {
    bg: 'var(--color-surface-container-lowest)',
    text: 'var(--color-on-surface)',
    chrome: 'var(--color-outline)',
  },
};

export interface CardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'> {
  children: ReactNode;
  mode?: Mode;
  tone?: Tone;
  padding?: Padding;
  /** Compatibility prop retained; Seesaw styling no longer uses depth shadows. */
  depth?: number;
  /** standard-mode only: use ambient soft shadow. Default true. */
  shadow?: boolean;
  className?: string;
}

export function Card({
  children,
  mode = 'standard',
  tone = 'surface',
  padding = 'md',
  depth: _depth = 5,
  shadow = true,
  className,
  style,
  ...props
}: CardProps) {
  const mantineContext = useContext(MantineContext);
  const toneStyle =
    mode === 'kid' ? KID_TONE_STYLE[tone] : STANDARD_TONE_STYLE[tone];
  const card = (
    <MantineCard
      className={cn('mantine-Card-root', className)}
      padding={PADDING_SIZE[padding]}
      radius={mode === 'kid' ? 8 : 12}
      withBorder
      style={{
        '--kit-card-bg': toneStyle.bg,
        '--kit-card-color': toneStyle.text,
        '--kit-card-border': toneStyle.chrome,
        backgroundColor: 'var(--kit-card-bg)',
        border: `1px solid ${toneStyle.chrome}`,
        borderRadius: mode === 'kid' ? 8 : 12,
        boxShadow: shadow || mode === 'kid' ? 'var(--shadow-soft-sm)' : 'none',
        color: 'var(--kit-card-color)',
        ...style,
      }}
      {...props}
    >
      {children}
    </MantineCard>
  );

  return mantineContext ? card : <MantineProvider>{card}</MantineProvider>;
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <Box
      className={className}
      mb={16}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      {...props}
    >
      {children}
    </Box>
  );
}

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardBody({ children, className, ...props }: CardBodyProps) {
  return (
    <Box
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      {...props}
    >
      {children}
    </Box>
  );
}
