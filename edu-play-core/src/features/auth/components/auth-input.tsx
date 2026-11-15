'use client';

import { MantineBoundary } from '@/shared/components/ui/kit';
import {
  ActionIcon,
  TextInput,
  type TextInputProps,
} from '@mantine/core';
import { forwardRef, useId, useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';

interface AuthInputProps
  extends Omit<
    TextInputProps,
    'className' | 'classNames' | 'error' | 'label' | 'leftSection' | 'rightSection' | 'styles'
  > {
  icon: IconName;
  error?: string;
  label?: string;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ icon, error, label, type, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    const field = (
      <TextInput
        ref={ref}
        id={inputId}
        type={inputType}
        label={label}
        error={error}
        leftSection={<Icon name={icon} aria-hidden />}
        leftSectionWidth={48}
        rightSectionPointerEvents={isPassword ? 'all' : undefined}
        rightSectionWidth={isPassword ? 56 : undefined}
        rightSection={
          isPassword ? (
            <ActionIcon
              type="button"
              variant="subtle"
              color="purple"
              size={44}
              aria-label={showPassword ? 'Ascunde parola' : 'Arată parola'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              <Icon name={showPassword ? 'EyeSlash' : 'Eye'} />
            </ActionIcon>
          ) : undefined
        }
        classNames={{
          root: 'space-y-2',
          label: 'ml-1 block font-label text-sm font-semibold text-on-surface-variant',
          input:
            'w-full rounded-md border border-outline-variant bg-surface-container-lowest font-label font-normal text-on-surface shadow-soft-sm outline-none transition-colors placeholder:text-on-surface-muted focus:border-primary focus:bg-surface-container-lowest focus-visible:ring-2 focus-visible:ring-primary/20',
          error: 'ml-1 mt-1 block text-sm text-error',
          section: 'text-on-surface-muted',
        }}
        styles={{ input: { minHeight: 56 } }}
        {...props}
      />
    );

    return <MantineBoundary>{field}</MantineBoundary>;
  }
);

AuthInput.displayName = 'AuthInput';
