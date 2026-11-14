import { createRef } from 'react';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it } from 'vitest';
import { TextareaField } from './TextareaField';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('TextareaField', () => {
  it('renders through Mantine while preserving label, helper and textarea ref', () => {
    const ref = createRef<HTMLTextAreaElement>();
    renderWithMantine(
      <TextareaField
        ref={ref}
        label="Instrucțiuni"
        helper="Scrie pașii pentru elevi."
        rows={5}
      />,
    );

    const textarea = screen.getByLabelText('Instrucțiuni');
    expect(textarea).toHaveClass('mantine-Textarea-input');
    expect(textarea).toHaveAttribute('rows', '5');
    expect(textarea).toHaveAccessibleDescription('Scrie pașii pentru elevi.');
    expect(ref.current).toBe(textarea);
  });

  it('surfaces error with role=alert and wires aria-invalid', () => {
    renderWithMantine(
      <TextareaField
        label="Feedback"
        error="Feedbackul trebuie completat."
        helper="Acest text nu apare când există eroare."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Feedbackul trebuie completat.',
    );
    expect(screen.getByLabelText('Feedback')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(
      screen.queryByText('Acest text nu apare când există eroare.'),
    ).not.toBeInTheDocument();
  });

  it('keeps hidden labels accessible and supports input-level style overrides', () => {
    renderWithMantine(
      <TextareaField
        label="Journal Note"
        labelHidden
        inputStyle={{ minHeight: 520 }}
      />,
    );

    const textarea = screen.getByLabelText('Journal Note');
    expect(textarea).toHaveClass('mantine-Textarea-input');
    expect(textarea).toHaveStyle({ minHeight: '520px' });
    expect(screen.getByText('Journal Note')).toHaveClass('sr-only');
  });
});
