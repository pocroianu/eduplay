import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AuthButton } from './auth-button';
import { AuthInput } from './auth-input';
import { LoginForm } from './login-form';

describe('AuthButton', () => {
  it('uses Mantine buttons instead of custom motion buttons', () => {
    const source = readFileSync(path.join(__dirname, 'auth-button.tsx'), 'utf8');

    expect(source).toContain('<MantineButton');
    expect(source).not.toContain('<motion.button');
  });

  it('uses flat Seesaw primary tokens for the primary variant', () => {
    render(<AuthButton>Autentificare</AuthButton>);
    const button = screen.getByRole('button', { name: /autentificare/i });
    const className = button.getAttribute('class') ?? '';

    expect(button).toHaveClass('mantine-Button-root');
    expect(className).toContain('bg-primary');
    expect(className).toContain('shadow-soft-sm');
    expect(className).toContain('rounded-lg');

  });

  it('keeps the social variant on a white rounded card treatment', () => {
    render(<AuthButton variant="social">Continuă cu Google</AuthButton>);
    const button = screen.getByRole('button', { name: /continuă cu google/i });
    const className = button.getAttribute('class') ?? '';

    expect(button).toHaveClass('mantine-Button-root');
    expect(className).toContain('bg-surface-container-lowest');
    expect(className).toContain('rounded-lg');
    expect(className).toContain('shadow-soft-sm');

  });

  it('uses rectangular Seesaw field chrome for auth inputs', () => {
    const { container } = render(<AuthInput icon="Envelope" label="Email" />);

    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    const className = input?.getAttribute('class') ?? '';

    expect(className).toContain('bg-surface-container-lowest');
    expect(className).toContain('rounded-md');
    expect(className).toContain('shadow-soft-sm');
    expect(className).not.toContain('rounded-full');
  });

  it('renders login form fields inside a white rounded form surface', () => {
    const { container } = render(<LoginForm />);

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    const className = form?.getAttribute('class') ?? '';

    expect(className).toContain('bg-surface-container-lowest');
    expect(className).toContain('rounded-xl');
  });
});
