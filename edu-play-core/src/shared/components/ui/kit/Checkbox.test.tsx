import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { createRef } from 'react';
import type { ReactNode } from 'react';
import { Checkbox } from './Checkbox';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('Checkbox', () => {
  it('associates label with input via htmlFor/id', () => {
    renderWithMantine(
      <Checkbox label="Ține-mă autentificat" name="rememberMe" />,
    );
    const input = screen.getByLabelText(/ține-mă autentificat/i);
    expect(input).toHaveAttribute('type', 'checkbox');
  });

  it('toggles on click through the label', () => {
    renderWithMantine(<Checkbox label="Accept termenii" />);
    const input = screen.getByLabelText(/accept termenii/i) as HTMLInputElement;
    expect(input.checked).toBe(false);
    fireEvent.click(input);
    expect(input.checked).toBe(true);
  });

  it('surfaces error with role=alert and wires aria-invalid', () => {
    renderWithMantine(
      <Checkbox label="Accept termenii" error="Obligatoriu" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Obligatoriu');
    expect(screen.getByLabelText(/accept termenii/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('renders through Mantine while preserving native props and input ref', () => {
    const ref = createRef<HTMLInputElement>();
    renderWithMantine(
      <Checkbox
        ref={ref}
        label="Trimite raportul săptămânal"
        name="weeklyReport"
        required
        disabled
      />,
    );

    const input = screen.getByLabelText(/trimite raportul/i);
    expect(input).toHaveClass('mantine-Checkbox-input');
    expect(input).toHaveAttribute('name', 'weeklyReport');
    expect(input).toBeRequired();
    expect(input).toBeDisabled();
    expect(ref.current).toBe(input);
  });
});
