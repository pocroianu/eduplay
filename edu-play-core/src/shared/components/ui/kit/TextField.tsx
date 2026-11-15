'use client';

import { MantineBoundary } from './MantineBoundary';
import {
  forwardRef,
  useId,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import {
  ActionIcon,
  Box,
  TextInput,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';

export interface TextFieldProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'className' | 'size' | 'prefix'
  > {
  label: string;
  /** Phosphor icon name rendered at the start of the input. */
  icon?: IconName;
  error?: string;
  /** Optional helper copy shown below the field when there is no error. */
  helper?: ReactNode;
  /** Keep the label available to assistive tech without showing it visually. */
  labelHidden?: boolean;
  /** Styles applied to Mantine's input slot. */
  inputStyle?: CSSProperties;
  /** Visual success indicator - renders a check when true. */
  success?: boolean;
  className?: string;
  /** Optional override for the auto-generated id. */
  id?: string;
  /** Optional test id applied to the input. */
  'data-testid'?: string;
}

const inputStyles = (hasError: boolean, inputStyle?: CSSProperties) => ({
  root: { width: '100%' },
  label: {
    color: 'var(--color-on-surface-variant)',
    fontFamily: 'var(--font-lexend)',
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'var(--color-surface-container-lowest)',
    borderColor: hasError ? 'var(--color-error)' : 'var(--color-outline)',
    borderRadius: 6,
    boxShadow: 'var(--shadow-soft-sm)',
    color: 'var(--color-on-surface)',
    fontWeight: 400,
    minHeight: 48,
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    ...inputStyle,
  },
  section: { color: 'var(--color-on-surface-muted)' },
});

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      icon,
      error,
      helper,
      labelHidden,
      inputStyle,
      success,
      type = 'text',
      id,
      required,
      className,
      disabled,
      ...rest
    },
    ref,
  ) => {
    const { t } = useTranslation('common');
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;
    const field = (
      <Box className={className}>
        <TextInput
          ref={ref}
          id={inputId}
          type={inputType}
          label={label}
          required={required}
          disabled={disabled}
          description={error ? undefined : helper}
          error={error}
          labelProps={labelHidden ? { className: 'sr-only' } : undefined}
          descriptionProps={{ id: helperId }}
          errorProps={{ id: errorId, role: 'alert' }}
          rightSectionPointerEvents={isPassword ? 'all' : undefined}
          leftSection={
            icon ? (
              <Icon
                name={icon}
                aria-hidden
                style={{ color: 'var(--color-on-surface-muted)' }}
              />
            ) : undefined
          }
          rightSection={
            isPassword ? (
              <ActionIcon
                type="button"
                variant="subtle"
                color="var(--color-on-surface-muted)"
                aria-label={
                  showPassword
                    ? t('fields.password.hide')
                    : t('fields.password.show')
                }
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
                styles={{
                  root: {
                    color: 'var(--color-on-surface-muted)',
                    '--ai-hover': 'var(--color-surface-container)',
                  },
                }}
              >
                <Icon name={showPassword ? 'EyeSlash' : 'Eye'} />
              </ActionIcon>
            ) : success ? (
              <Icon
                name="CheckCircle"
                weight="fill"
                aria-hidden
                style={{ color: 'var(--color-primary)' }}
              />
            ) : undefined
          }
          styles={inputStyles(Boolean(error), inputStyle)}
          {...rest}
        />
      </Box>
    );

    return <MantineBoundary>{field}</MantineBoundary>;
  },
);

TextField.displayName = 'TextField';
