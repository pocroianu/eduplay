import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthShell } from './AuthShell';

describe('AuthShell (standard mode)', () => {
  it('renders title, subtitle and children', () => {
    render(
      <AuthShell title="Bun venit" subtitle="Intră în cont">
        <div>FormGoesHere</div>
      </AuthShell>,
    );

    expect(screen.getByRole('heading', { name: /bun venit/i })).toBeInTheDocument();
    expect(screen.getByText(/intră în cont/i)).toBeInTheDocument();
    expect(screen.getByText('FormGoesHere')).toBeInTheDocument();
  });

  it('renders provided heroSlot instead of default', () => {
    render(
      <AuthShell title="t" heroSlot={<div>CustomHero</div>}>
        <span>c</span>
      </AuthShell>,
    );

    expect(screen.getByText('CustomHero')).toBeInTheDocument();
  });

  it('exposes the title as the page h1', () => {
    render(
      <AuthShell title="visible title">
        <span>c</span>
      </AuthShell>,
    );

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('visible title');
    expect(h1).not.toHaveClass('sr-only');
  });
});

describe('AuthShell (kid mode)', () => {
  it('renders children inside the shell', () => {
    render(
      <AuthShell mode="kid">
        <div>Pin pad</div>
      </AuthShell>,
    );

    expect(screen.getByText('Pin pad')).toBeInTheDocument();
  });

  it('renders a back link when supplied', () => {
    render(
      <AuthShell mode="kid" backLink={{ href: '/login', label: 'Sunt profesor' }}>
        <span>c</span>
      </AuthShell>,
    );

    const link = screen.getByRole('link', { name: /sunt profesor/i });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('uses a child-route touch target for the kid back link', () => {
    render(
      <AuthShell mode="kid" backLink={{ href: '/login', label: 'Sunt profesor' }}>
        <span>c</span>
      </AuthShell>,
    );

    expect(screen.getByRole('link', { name: /sunt profesor/i })).toHaveClass('min-h-16');
  });
});
