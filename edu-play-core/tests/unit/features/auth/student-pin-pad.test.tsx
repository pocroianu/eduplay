import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStudentLogin = vi.fn();

vi.mock('framer-motion', () => {
  type AnyProps = Record<string, unknown> & { children?: React.ReactNode };
  const factory = (tag: keyof React.JSX.IntrinsicElements) => {
    const MotionComponent = ({ children, ...props }: AnyProps) => {
      const Tag = tag as unknown as React.ElementType;
      return <Tag {...(props as object)}>{children as React.ReactNode}</Tag>;
    };
    MotionComponent.displayName = `motion.${String(tag)}`;
    return MotionComponent;
  };
  const AnimatePresence = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  AnimatePresence.displayName = 'AnimatePresence';
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, prop) => factory(prop as keyof React.JSX.IntrinsicElements),
      },
    ),
    useReducedMotion: () => false,
    AnimatePresence,
  };
});

vi.mock('@/config/animations', () => ({
  buttonHover: {},
  buttonTap: { tap: {} },
  pinDotFill: {},
  pinShake: {},
  staggerContainer: {},
  staggerItem: {},
  transitions: { press: {}, smooth: {}, snappy: {}, spring: {}, springBouncy: {} },
}));

vi.mock('@/features/auth/actions/student-login', () => ({
  studentLogin: (...args: unknown[]) => mockStudentLogin(...args),
}));

vi.mock('@/features/auth/utils/student-login-errors', () => ({
  STUDENT_LOGIN_RATE_LIMITED_CODE: 'STUDENT_LOGIN_RATE_LIMITED',
  isStudentLoginRateLimited: (message: string) =>
    message.startsWith('STUDENT_LOGIN_RATE_LIMITED:'),
}));

import { StudentPinPad } from '@/features/auth/components/student-pin-pad';

function renderPinPad() {
  return render(<StudentPinPad />);
}

function digitButton(n: number) {
  return screen.getByRole('button', { name: new RegExp(`^cifra ${n}$`, 'i') });
}

function submitButton() {
  return screen.getByRole('button', { name: /trimite pin-ul/i });
}

function backspaceButton() {
  return screen.getByRole('button', { name: /șterge/i });
}

function usernameField() {
  return screen.getByPlaceholderText(/ex: andrei_m/i);
}

describe('StudentPinPad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('keeps recent-user controls on Mantine buttons', () => {
    window.localStorage.setItem('eduplay:student-recent-usernames', JSON.stringify(['alex']));

    renderPinPad();

    expect(screen.getByRole('button', { name: /alex/i })).toHaveClass('mantine-Button-root');
    const clearRecentsButton = screen
      .getAllByRole('button', { name: /^șterge$/i })
      .find((button) => button.classList.contains('mantine-Button-root'));
    expect(clearRecentsButton).toHaveClass('mantine-Button-root');

    const source = readFileSync(
      join(process.cwd(), 'src/features/auth/components/student-pin-pad.tsx'),
      'utf8',
    );
    expect(source).not.toContain('<button');
  });

  it('renders the username field, keypad, and disabled submit button initially', () => {
    renderPinPad();

    expect(usernameField()).toBeInTheDocument();
    expect(digitButton(1)).toBeInTheDocument();
    expect(digitButton(0)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('enables submit after four digits', async () => {
    const user = userEvent.setup();
    renderPinPad();

    await user.click(digitButton(1));
    await user.click(digitButton(2));
    await user.click(digitButton(3));
    await user.click(digitButton(4));

    expect(submitButton()).toBeEnabled();

    // Extra digits should be ignored (pin stays at 4)
    await user.click(digitButton(5));
    expect(submitButton()).toBeEnabled();
  });

  it('removes digits with backspace and keeps submit disabled when pin becomes incomplete', async () => {
    const user = userEvent.setup();
    renderPinPad();

    await user.click(digitButton(1));
    await user.click(digitButton(2));
    await user.click(digitButton(3));
    await user.click(digitButton(4));

    expect(submitButton()).toBeEnabled();

    await user.click(backspaceButton());

    expect(submitButton()).toBeDisabled();
  });

  it('does not submit when pin is incomplete', async () => {
    const user = userEvent.setup();
    renderPinPad();

    await user.type(usernameField(), 'alex');
    await user.click(digitButton(1));
    await user.click(digitButton(2));
    await user.click(digitButton(3));

    expect(submitButton()).toBeDisabled();
    expect(mockStudentLogin).not.toHaveBeenCalled();
  });

  it('submits username and pin when the form is valid', async () => {
    const user = userEvent.setup();
    mockStudentLogin.mockResolvedValue(undefined);

    renderPinPad();

    await user.type(usernameField(), 'alex');
    await user.click(digitButton(1));
    await user.click(digitButton(2));
    await user.click(digitButton(3));
    await user.click(digitButton(4));
    await user.click(submitButton());

    await waitFor(() => {
      expect(mockStudentLogin).toHaveBeenCalledTimes(1);
    });

    const formData = mockStudentLogin.mock.calls[0][0] as FormData;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('username')).toBe('alex');
    expect(formData.get('pin')).toBe('1234');
  });

  it('shows an error message and clears the pin when login fails', async () => {
    const user = userEvent.setup();
    mockStudentLogin.mockRejectedValue(new Error('Credențiale invalide'));

    renderPinPad();

    await user.type(usernameField(), 'alex');
    await user.click(digitButton(1));
    await user.click(digitButton(2));
    await user.click(digitButton(3));
    await user.click(digitButton(4));
    await user.click(submitButton());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Credențiale invalide');
    });

    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
  });

  describe('Vulpița mood transitions', () => {
    function renderWithMoodSpy(lockoutResetMs?: number) {
      const moods: string[] = [];
      const utils = render(
        <StudentPinPad
          lockoutResetMs={lockoutResetMs}
          onMoodChange={(mood) => {
            moods.push(mood);
          }}
        />,
      );

      return { ...utils, moods };
    }

    it('starts happy and switches to think on a generic credential failure', async () => {
      const user = userEvent.setup();
      mockStudentLogin.mockRejectedValue(new Error('Nume de utilizator sau PIN greșit'));

      const { moods } = renderWithMoodSpy();

      await waitFor(() => {
        expect(moods).toContain('happy');
      });

      await user.type(usernameField(), 'alex');
      await user.click(digitButton(1));
      await user.click(digitButton(2));
      await user.click(digitButton(3));
      await user.click(digitButton(4));
      await user.click(submitButton());

      await waitFor(() => {
        expect(moods).toContain('think');
      });
    });

    it('switches to sleep mood and locks the form when the rate limiter trips', async () => {
      const user = userEvent.setup();
      mockStudentLogin.mockRejectedValue(
        new Error('STUDENT_LOGIN_RATE_LIMITED:15'),
      );

      const { moods } = renderWithMoodSpy();

      await user.type(usernameField(), 'alex');
      await user.click(digitButton(1));
      await user.click(digitButton(2));
      await user.click(digitButton(3));
      await user.click(digitButton(4));
      await user.click(submitButton());

      await waitFor(() => {
        expect(moods).toContain('sleep');
      });

      expect(screen.getByRole('alert')).toHaveTextContent('Hopa! Încearcă mai târziu.');
      expect(screen.getByRole('alert')).not.toHaveTextContent(/STUDENT_LOGIN_RATE_LIMITED|prea multe încercări|15 minute/i);
      expect(usernameField()).toBeDisabled();
      expect(digitButton(1)).toBeDisabled();
    });

    it('unlocks the form after the temporary rate-limit window expires', async () => {
      const user = userEvent.setup();
      mockStudentLogin.mockRejectedValue(
        new Error('STUDENT_LOGIN_RATE_LIMITED:15'),
      );

      renderWithMoodSpy(1);

      await user.type(usernameField(), 'alex');
      await user.click(digitButton(1));
      await user.click(digitButton(2));
      await user.click(digitButton(3));
      await user.click(digitButton(4));
      await user.click(submitButton());

      await waitFor(() => {
        expect(usernameField()).toBeDisabled();
      });

      await waitFor(() => {
        expect(usernameField()).toBeEnabled();
        expect(digitButton(1)).toBeEnabled();
      });
    });
  });
});
