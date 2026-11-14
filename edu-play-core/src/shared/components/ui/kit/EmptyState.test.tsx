import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';
import { Button } from './Button';

describe('EmptyState', () => {
  it('renders title, description, and icon', () => {
    const { container } = render(
      <EmptyState
        icon="Users"
        title="Nu ai încă elevi"
        description="Adaugă primul tău elev ca să începi."
      />,
    );
    expect(screen.getByText('Nu ai încă elevi')).toBeInTheDocument();
    expect(screen.getByText('Adaugă primul tău elev ca să începi.')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders the provided action slot', () => {
    render(
      <EmptyState
        icon="Plus"
        title="Nu există clase"
        action={<Button>Adaugă clasă</Button>}
      />,
    );
    expect(screen.getByRole('button', { name: /adaugă clasă/i })).toBeInTheDocument();
  });

  it('wraps the decorative icon in an aria-hidden element with tonal badge styling', () => {
    const { container } = render(<EmptyState icon="Info" title="Nimic aici" />);
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden).toBeTruthy();
    expect(hidden?.querySelector('svg')).toBeTruthy();
    expect(hidden?.className).toContain('shadow-soft-sm');
    expect(hidden?.className).not.toContain('border-ink');
    expect(hidden?.className).toContain('bg-primary-soft');
  });

  it('applies py-16 padding baseline', () => {
    const { container } = render(<EmptyState icon="Info" title="Gol" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('py-16');
  });
});
