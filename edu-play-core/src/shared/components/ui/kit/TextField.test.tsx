import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { createRef } from 'react';
import type { ReactNode } from 'react';
import { TextField } from './TextField';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('TextField', () => {
  it('associates label with input via htmlFor/id', () => {
    renderWithMantine(<TextField label="Adresă de email" name="email" />);
    const input = screen.getByLabelText('Adresă de email');
    expect(input.tagName).toBe('INPUT');
  });

  it('renders an error with role=alert and sets aria-invalid', () => {
    renderWithMantine(<TextField label="Parolă" error="Parolă obligatorie" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Parolă obligatorie');
    expect(screen.getByLabelText('Parolă')).toHaveAttribute('aria-invalid', 'true');
  });

  it('toggles password visibility and updates aria-pressed', () => {
    renderWithMantine(<TextField label="Parolă" type="password" />);
    const toggle = screen.getByRole('button', { name: /arată parola/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(
      screen.getByRole('button', { name: /ascunde parola/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders through Mantine while preserving helper, icon, success and input ref', () => {
    const ref = createRef<HTMLInputElement>();
    renderWithMantine(
      <TextField
        ref={ref}
        label="Cod clasă"
        icon="MagnifyingGlass"
        helper="Îl găsești pe invitația primită."
        success
        data-testid="class-code"
      />,
    );

    const input = screen.getByTestId('class-code');
    expect(input).toHaveClass('mantine-TextInput-input');
    expect(input).toHaveAccessibleDescription('Îl găsești pe invitația primită.');
    expect(ref.current).toBe(input);
    expect(screen.getByText('Îl găsești pe invitația primită.')).toBeInTheDocument();
    expect(document.querySelector('.mantine-TextInput-section')).toBeInTheDocument();
  });

  it('keeps hidden labels accessible and supports input-level style overrides', () => {
    renderWithMantine(
      <TextField
        label="Caută activități"
        labelHidden
        inputStyle={{ minHeight: 44 }}
      />,
    );

    const input = screen.getByLabelText('Caută activități');
    expect(input).toHaveClass('mantine-TextInput-input');
    expect(input).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByText('Caută activități')).toHaveClass('sr-only');
  });
});
