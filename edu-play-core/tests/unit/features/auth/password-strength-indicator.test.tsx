import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PasswordStrengthIndicator } from '@/features/auth/components/password-strength-indicator';
import { calculatePasswordStrength } from '@/features/auth/utils/calculate-password-strength';

function renderWithProviders(ui: React.ReactElement) {
  return render(ui);
}

describe('PasswordStrengthIndicator', () => {
  it('renders nothing for an empty password', () => {
    const { container } = renderWithProviders(<PasswordStrengthIndicator password="" />);

    expect(screen.queryByText(/puterea parolei/i)).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid^="requirement-"]')).toBeNull();
  });

  it('renders weak password state with unmet requirements', () => {
    const password = 'abc';
    const { label } = calculatePasswordStrength(password);

    renderWithProviders(<PasswordStrengthIndicator password={password} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByTestId('requirement-minLength')).toHaveAttribute('data-met', 'false');
    expect(screen.getByTestId('requirement-hasUppercase')).toHaveAttribute('data-met', 'false');
    expect(screen.getByTestId('requirement-hasLowercase')).toHaveAttribute('data-met', 'true');
  });

  it('renders an intermediate password state', () => {
    const password = 'Abcdef12';
    const { label } = calculatePasswordStrength(password);

    renderWithProviders(<PasswordStrengthIndicator password={password} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByTestId('requirement-minLength')).toHaveAttribute('data-met', 'true');
    expect(screen.getByTestId('requirement-hasNumber')).toHaveAttribute('data-met', 'true');
    expect(screen.getByTestId('requirement-hasSpecial')).toHaveAttribute('data-met', 'false');
  });

  it('renders a strong password state with all requirements met', () => {
    const password = 'Parola123!';
    const { label } = calculatePasswordStrength(password);

    renderWithProviders(<PasswordStrengthIndicator password={password} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(/puterea parolei/i)).toBeInTheDocument();
    expect(screen.getByTestId('requirement-minLength')).toHaveAttribute('data-met', 'true');
    expect(screen.getByTestId('requirement-hasUppercase')).toHaveAttribute('data-met', 'true');
    expect(screen.getByTestId('requirement-hasLowercase')).toHaveAttribute('data-met', 'true');
    expect(screen.getByTestId('requirement-hasNumber')).toHaveAttribute('data-met', 'true');
    expect(screen.getByTestId('requirement-hasSpecial')).toHaveAttribute('data-met', 'true');
  });
});
