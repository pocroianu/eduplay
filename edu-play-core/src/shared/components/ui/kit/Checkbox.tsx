'use client';

import {
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import {
  Box,
  Checkbox as MantineCheckbox,
  MantineContext,
  MantineProvider,
  Text,
} from '@mantine/core';

export interface CheckboxProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'className' | 'type' | 'children' | 'size'
  > {
  /** Label content - strings, RichText, or composed nodes. */
  label: ReactNode;
  className?: string;
  /** Error message - makes the box error-toned and wires aria-describedby. */
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, error, id, required, disabled, ...rest }, ref) => {
    const mantineContext = useContext(MantineContext);
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const describedBy = error ? errorId : rest['aria-describedby'];

    const checkbox = (
      <Box className={className}>
        <MantineCheckbox
          ref={ref}
          id={inputId}
          label={label}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          styles={{
            root: { opacity: disabled ? 0.6 : 1 },
            body: { alignItems: 'flex-start', gap: 12 },
            input: {
              backgroundColor: 'var(--color-surface-container)',
              borderColor: error ? 'var(--color-error)' : 'transparent',
              borderRadius: 6,
              cursor: disabled ? 'not-allowed' : 'pointer',
              height: 24,
              marginTop: 2,
              width: 24,
            },
            icon: { color: 'var(--color-on-primary)' },
            label: {
              color: 'var(--color-on-surface-variant)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: 14,
              lineHeight: 1.55,
              paddingInlineStart: 0,
            },
          }}
          {...rest}
        />
        {error ? (
          <Text
            id={errorId}
            role="alert"
            size="sm"
            style={{
              color: 'var(--color-error)',
              marginLeft: 36,
              marginTop: 4,
            }}
          >
            {error}
          </Text>
        ) : null}
      </Box>
    );

    return mantineContext ? (
      checkbox
    ) : (
      <MantineProvider>{checkbox}</MantineProvider>
    );
  },
);

Checkbox.displayName = 'Checkbox';
