'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';

export interface KidTextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size' | 'prefix'> {
  label: string;
  icon?: IconName;
  error?: string;
  helper?: ReactNode;
  className?: string;
}

/**
 * Kid-mode text input. 72px tall, 20px body font, round pill with
 * chunky outline so the hit area is obviously tappable. Label is always
 * visible and wired via htmlFor/id.
 */
export const KidTextField = forwardRef<HTMLInputElement, KidTextFieldProps>(
  ({ label, icon = 'User', error, helper, className, id, disabled, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const describedBy = error ? errorId : helper ? helperId : undefined;

    return (
      <div className={cn('space-y-2', className)}>
        <label
          htmlFor={inputId}
          className="block font-headline text-lg font-bold text-on-surface"
        >
          {label}
        </label>
        <div className="relative">
          <Icon
            name={icon}
            size={28}
            aria-hidden
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'h-[64px] w-full rounded-full border-2 bg-surface-container-lowest pl-[60px] pr-5 font-label text-xl font-semibold text-on-surface outline-none transition-all duration-150 disabled:opacity-60',
              'focus-visible:ring-4 focus-visible:ring-primary-soft',
              error
                ? 'border-error focus-visible:border-error focus-visible:ring-error/20'
                : 'border-outline-variant focus-visible:border-primary',
            )}
            {...rest}
          />
        </div>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="ml-2 text-base font-semibold text-error"
          >
            {error}
          </p>
        ) : helper ? (
          <p id={helperId} className="ml-2 text-sm text-on-surface-variant">
            {helper}
          </p>
        ) : null}
      </div>
    );
  },
);

KidTextField.displayName = 'KidTextField';
