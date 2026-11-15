'use client';

import { MantineBoundary } from '@/shared/components/ui/kit';
import {
  Anchor,
  type AnchorProps,
} from '@mantine/core';
import NextLink from 'next/link';
import { type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';

export interface AuthInlineLinkProps
  extends Omit<AnchorProps, 'children' | 'className' | 'component' | 'href'> {
  href: string;
  children: ReactNode;
  className?: string;
}

export function AuthInlineLink({
  href,
  children,
  className,
  ...props
}: AuthInlineLinkProps) {
  const link = (
    <Anchor
      component={NextLink}
      href={href}
      c="purple"
      underline="hover"
      className={cn(
        'inline-flex min-h-11 items-center rounded px-1 font-bold underline-offset-4 decoration-2',
        className,
      )}
      {...props}
    >
      {children}
    </Anchor>
  );

  return <MantineBoundary>{link}</MantineBoundary>;
}
