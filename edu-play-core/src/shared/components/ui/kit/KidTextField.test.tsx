import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KidTextField } from './KidTextField';

describe('KidTextField', () => {
  it('forwards the native input ref and associates the label and helper', () => {
    const ref = createRef<HTMLInputElement>();
    render(<KidTextField ref={ref} label="Nume" name="name" helper="Scrie numele" />);
    const input = screen.getByRole('textbox', { name: 'Nume' });
    expect(ref.current).toBe(input);
    expect(input).toHaveAttribute('name', 'name');
    expect(input).toHaveAccessibleDescription('Scrie numele');
    expect(input).toHaveClass('h-[64px]');
  });

  it('associates errors with the input', () => {
    render(<KidTextField label="Nume" error="Completează numele" />);
    const input = screen.getByRole('textbox', { name: 'Nume' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Completează numele');
  });

  it('forwards native disabled and required state with an explicit id', () => {
    render(<KidTextField id="child-name" label="Nume" disabled required />);
    const input = screen.getByRole('textbox', { name: 'Nume' });
    expect(input).toHaveAttribute('id', 'child-name');
    expect(input).toBeDisabled();
    expect(input).toBeRequired();
  });
});
