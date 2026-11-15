import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Component, type ReactNode } from 'react';

// Mock the login action
vi.mock('@/features/auth/actions/login', () => ({
  login: vi.fn(),
}));

// Import after mocking
import { LoginForm } from '@/features/auth/components/login-form';
import { login } from '@/features/auth/actions/login';

function renderLoginForm() {
  return render(<LoginForm />);
}

class NavigationBoundary extends Component<{ children: ReactNode; onSignal: (error: Error) => void }, { caught: boolean }> {
  state = { caught: false };
  static getDerivedStateFromError() { return { caught: true }; }
  componentDidCatch(error: Error) { this.props.onSignal(error); }
  render() { return this.state.caught ? <p>Navigation signal</p> : this.props.children; }
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render email input', () => {
      renderLoginForm();

      const emailInput = screen.getByPlaceholderText('nume@exemplu.ro');
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('should render password input', () => {
      renderLoginForm();

      const passwordInput = screen.getByPlaceholderText('••••••••');
      expect(passwordInput).toBeInTheDocument();
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should render forgot password link', () => {
      renderLoginForm();

      expect(screen.getByTestId('teacher-forgot-password-link')).toHaveTextContent(
        /am uitat parola/i,
      );
    });

    it('should render login button', () => {
      renderLoginForm();

      const button = screen.getByRole('button', { name: /autentificare/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should have correct placeholder text', () => {
      renderLoginForm();

      expect(screen.getByPlaceholderText('nume@exemplu.ro')).toBeInTheDocument();
    });

    it('should render label text for email and password', () => {
      renderLoginForm();

      expect(screen.getByText('Adresă de email')).toBeInTheDocument();
      expect(screen.getByText('Parolă')).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    it('should not call login action with invalid form data', async () => {
      const user = userEvent.setup();
      renderLoginForm();

      const submitButton = screen.getByRole('button', { name: /autentificare/i });

      // Submit without filling any fields
      await user.click(submitButton);

      // Login action should not be called with invalid data
      expect(login).not.toHaveBeenCalled();
    });

    it('should show error for short password', async () => {
      const user = userEvent.setup();
      renderLoginForm();

      const emailInput = screen.getByPlaceholderText('nume@exemplu.ro');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /autentificare/i });

      await user.type(emailInput, 'valid@email.com');
      await user.type(passwordInput, '123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/cel puțin 6 caractere/i)).toBeInTheDocument();
      });
    });

    it('should not submit form with empty fields', async () => {
      const user = userEvent.setup();
      renderLoginForm();

      const submitButton = screen.getByRole('button', { name: /autentificare/i });
      await user.click(submitButton);

      expect(login).not.toHaveBeenCalled();
    });
  });

  describe('form submission', () => {
    it('should call login action with form data on valid submission', async () => {
      const user = userEvent.setup();
      (login as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      renderLoginForm();

      const emailInput = screen.getByPlaceholderText('nume@exemplu.ro');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /autentificare/i });

      await user.type(emailInput, 'teacher@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(login).toHaveBeenCalled();
      });

      // Verify FormData contains correct values
      const callArg = (login as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg).toBeInstanceOf(FormData);
      expect(callArg.get('email')).toBe('teacher@example.com');
      expect(callArg.get('password')).toBe('password123');
    });


    it('should display server error when login throws', async () => {
      const user = userEvent.setup();
      (login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid credentials'));

      renderLoginForm();

      const emailInput = screen.getByPlaceholderText('nume@exemplu.ro');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /autentificare/i });

      await user.type(emailInput, 'teacher@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
      });
    });
  });

  describe('loading state', () => {
    it('preserves framework redirects instead of showing NEXT_REDIRECT as a login error', async () => {
      const user = userEvent.setup();
      const signal = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/parent;307;' });
      vi.mocked(login).mockRejectedValue(signal);
      const onSignal = vi.fn();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        render(<NavigationBoundary onSignal={onSignal}><LoginForm /></NavigationBoundary>);
        await user.type(screen.getByRole('textbox', { name: 'Adresă de email' }), 'parent@example.com');
        await user.type(screen.getByLabelText('Parolă'), 'password123');
        await user.click(screen.getByRole('button', { name: /autentificare/i }));
        await waitFor(() => expect(onSignal).toHaveBeenCalledWith(signal));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      } finally {
        consoleError.mockRestore();
      }
    });

    it('should disable inputs during submission', async () => {
      const user = userEvent.setup();

      let resolveLogin: () => void;
      const loginPromise = new Promise<void>((resolve) => {
        resolveLogin = resolve;
      });
      (login as ReturnType<typeof vi.fn>).mockReturnValue(loginPromise);

      renderLoginForm();

      const emailInput = screen.getByPlaceholderText('nume@exemplu.ro');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /autentificare/i });

      await user.type(emailInput, 'teacher@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(emailInput).toBeDisabled();
        expect(passwordInput).toBeDisabled();
      });

      resolveLogin!();
    });
  });

  describe('accessibility', () => {
    it('should have proper form structure', () => {
      renderLoginForm();

      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('should have submit button with correct type', () => {
      renderLoginForm();

      const submitButton = screen.getByRole('button', { name: /autentificare/i });
      expect(submitButton).toHaveAttribute('type', 'submit');
    });
  });
});
