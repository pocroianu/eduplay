'use client'

import { Button, type ButtonProps } from '@mantine/core'
import Link from 'next/link'
import type { MouseEventHandler, ReactNode } from 'react'

export type ActivityActionTone = 'primary' | 'secondary' | 'quiet' | 'danger' | 'restore'

interface ActivityActionButtonProps
  extends Omit<
    ButtonProps,
    'children' | 'color' | 'component' | 'fullWidth' | 'href' | 'loading' | 'radius' | 'size' | 'variant'
  > {
  children: ReactNode
  href?: string
  isPending?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  tone?: ActivityActionTone
  fullWidth?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const TONE_PROPS: Record<ActivityActionTone, Pick<ButtonProps, 'color' | 'variant'>> = {
  primary: { color: 'purple', variant: 'filled' },
  secondary: { color: 'purple', variant: 'light' },
  quiet: { color: 'gray', variant: 'default' },
  danger: { color: 'red', variant: 'light' },
  restore: { color: 'purple', variant: 'light' },
}

export function ActivityActionButton({
  children,
  disabled,
  fullWidth,
  href,
  isPending = false,
  onClick,
  tone = 'secondary',
  type = 'button',
  ...props
}: ActivityActionButtonProps) {
  const toneProps = TONE_PROPS[tone]
  const sharedProps = {
    ...props,
    ...toneProps,
    disabled: disabled || isPending,
    fullWidth,
    radius: 'xl',
    size: 'sm',
    styles: {
      root: {
        fontWeight: 700,
        minHeight: 44,
      },
    },
  } satisfies ButtonProps

  if (href) {
    return (
      <Button component={Link} href={href} {...sharedProps}>
        {children}
      </Button>
    )
  }

  return (
    <Button type={type} onClick={onClick} {...sharedProps}>
      {children}
    </Button>
  )
}
