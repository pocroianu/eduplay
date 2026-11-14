'use client';

import {
  forwardRef,
  useContext,
  useId,
  type CSSProperties,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Box, MantineContext, MantineProvider, Textarea } from '@mantine/core';

export interface TextareaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  label: string;
  error?: string;
  helper?: ReactNode;
  labelHidden?: boolean;
  inputStyle?: CSSProperties;
  className?: string;
  id?: string;
}

const textareaStyles = (hasError: boolean, inputStyle?: CSSProperties) => ({
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
    minHeight: 112,
    padding: '12px 16px',
    resize: 'vertical' as const,
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    ...inputStyle,
  },
});

export const TextareaField = forwardRef<
  HTMLTextAreaElement,
  TextareaFieldProps
>(
  (
    {
      label,
      error,
      helper,
      labelHidden,
      inputStyle,
      id,
      required,
      className,
      disabled,
      rows = 4,
      ...rest
    },
    ref,
  ) => {
    const mantineContext = useContext(MantineContext);
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;
    const field = (
      <Box className={className}>
        <Textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          label={label}
          required={required}
          disabled={disabled}
          description={error ? undefined : helper}
          error={error}
          labelProps={labelHidden ? { className: 'sr-only' } : undefined}
          descriptionProps={{ id: helperId }}
          errorProps={{ id: errorId, role: 'alert' }}
          styles={textareaStyles(Boolean(error), inputStyle)}
          {...rest}
        />
      </Box>
    );

    return mantineContext ? field : <MantineProvider>{field}</MantineProvider>;
  },
);

TextareaField.displayName = 'TextareaField';
