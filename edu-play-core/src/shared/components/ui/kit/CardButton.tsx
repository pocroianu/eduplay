'use client';

import { MantineBoundary } from './MantineBoundary';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { UnstyledButton } from '@mantine/core';
import { cn } from '@/shared/lib/utils/cn';
import classes from './CardButton.module.css';

interface CardButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  children: ReactNode;
  className?: string;
}

export const CardButton = forwardRef<HTMLButtonElement, CardButtonProps>(
  ({ children, className, type = 'button', ...props }, ref) => {
    const button = (
      <UnstyledButton
        ref={ref}
        type={type}
        className={cn(classes.root, className)}
        {...props}
      >
        {children}
      </UnstyledButton>
    );

    return <MantineBoundary>{button}</MantineBoundary>;
  },
);

CardButton.displayName = 'CardButton';
