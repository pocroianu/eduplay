import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResetPassword = vi.fn();

vi.mock('@/features/auth/actions/reset-password', () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
}));

import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';
import { ROUTES } from '@/shared/lib/constants/routes';
// Note: the "Înapoi la autentificare" link now lives in the AuthShell footer
// (see src/app/(auth)/reset-password/page.tsx), not inside this form.

function renderWithProviders(ui: React.ReactElement) {
  return render(ui);
}

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both password inputs and submit button', () => {
    renderWithProviders(<ResetPasswordForm />);

    expect(screen.getByTestId('password-input')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeInTheDocument();
  });

  it('toggles the visibility of both password fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordForm />);

    const passwordInput = screen.getByTestId('password-input');
    const confirmPasswordInput = screen.getByTestId('confirm-password-input');
    const buttons = screen.getAllByRole('button');
    const passwordToggle = buttons[0];
    const confirmPasswordToggle = buttons[1];

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    await user.click(passwordToggle);
    await user.click(confirmPasswordToggle);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(confirmPasswordInput).toHaveAttribute('type', 'text');
  });

  it('shows the strength indicator only after typing a password', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordForm />);

    expect(screen.queryByText(/puterea parolei/i)).not.toBeInTheDocument();

    await user.type(screen.getByTestId('password-input'), 'Parola123!');

    expect(screen.getByText(/puterea parolei/i)).toBeInTheDocument();
    expect(screen.getByTestId('requirement-hasSpecial')).toHaveAttribute('data-met', 'true');
  });

  it('blocks invalid submission and shows client-side validation errors', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordForm />);

    await user.type(screen.getByTestId('password-input'), 'Parola123!');
    await user.type(screen.getByTestId('confirm-password-input'), 'AltaParola123!');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(screen.getByText(/parolele nu se potrivesc/i)).toBeInTheDocument();
    });

    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('submits form data when the form is valid', async () => {
    const user = userEvent.setup();
    mockResetPassword.mockResolvedValue({ success: true });

    renderWithProviders(<ResetPasswordForm />);

    await user.type(screen.getByTestId('password-input'), 'Parola123!');
    await user.type(screen.getByTestId('confirm-password-input'), 'Parola123!');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledTimes(1);
    });

    const formData = mockResetPassword.mock.calls[0][0] as FormData;
    expect(formData.get('password')).toBe('Parola123!');
    expect(formData.get('confirmPassword')).toBe('Parola123!');
  });

  it('shows a recovery link for expired or invalid reset links', async () => {
    const user = userEvent.setup();
    mockResetPassword.mockResolvedValue({
      success: false,
      error: 'Link-ul de resetare a expirat sau este invalid. Te rugăm să soliciți un link nou.',
    });

    renderWithProviders(<ResetPasswordForm />);

    await user.type(screen.getByTestId('password-input'), 'Parola123!');
    await user.type(screen.getByTestId('confirm-password-input'), 'Parola123!');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /solicită un link nou/i })).toHaveAttribute(
      'href',
      ROUTES.AUTH.FORGOT_PASSWORD,
    );
  });

  it('shows a generic server error without the recovery link', async () => {
    const user = userEvent.setup();
    mockResetPassword.mockResolvedValue({
      success: false,
      error: 'Nu am putut reseta parola. Te rugăm să încerci din nou.',
    });

    renderWithProviders(<ResetPasswordForm />);

    await user.type(screen.getByTestId('password-input'), 'Parola123!');
    await user.type(screen.getByTestId('confirm-password-input'), 'Parola123!');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: /solicită un link nou/i })).not.toBeInTheDocument();
  });

  it('ignores NEXT_REDIRECT errors from the server action', async () => {
    const user = userEvent.setup();
    mockResetPassword.mockRejectedValue(new Error('NEXT_REDIRECT'));

    renderWithProviders(<ResetPasswordForm />);

    await user.type(screen.getByTestId('password-input'), 'Parola123!');
    await user.type(screen.getByTestId('confirm-password-input'), 'Parola123!');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
  });

  it('shows a fallback error for unexpected thrown failures', async () => {
    const user = userEvent.setup();
    mockResetPassword.mockRejectedValue(new Error('boom'));

    renderWithProviders(<ResetPasswordForm />);

    await user.type(screen.getByTestId('password-input'), 'Parola123!');
    await user.type(screen.getByTestId('confirm-password-input'), 'Parola123!');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/a apărut o eroare neașteptată\. te rugăm să încerci din nou\./i),
    ).toBeInTheDocument();
  });
});
