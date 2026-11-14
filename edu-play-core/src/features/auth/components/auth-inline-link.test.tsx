import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthInlineLink } from './auth-inline-link';

describe('AuthInlineLink', () => {
  it('renders an inline Mantine anchor with the requested destination', () => {
    render(<AuthInlineLink href="/login">Autentificare</AuthInlineLink>);

    const link = screen.getByRole('link', { name: /autentificare/i });
    expect(link).toHaveAttribute('href', '/login');
    expect(link).toHaveClass('mantine-Anchor-root');
    expect(link).toHaveClass('min-h-11');
  });
});
