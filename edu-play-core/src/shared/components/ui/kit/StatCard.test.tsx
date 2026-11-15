import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard (standard)', () => {
  it('renders label, value, and icon', () => {
    const { container } = render(
      <StatCard label="Total Elevi" value={42} icon="Users" tone="primary" />,
    );
    expect(screen.getByText('Total Elevi')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    // Icon is rendered via the Phosphor shim (EDU-123) — assert on the SVG.
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('defaults to primary tone when tone is omitted', () => {
    const { container } = render(<StatCard label="Label" value="7" icon="Lightning" />);
    const chip = container.querySelector('[aria-hidden="true"]');
    expect(chip?.className).toContain('bg-primary/10');
    expect(chip?.className).toContain('text-primary');
  });

  it('applies tertiary tone classes (mapped to EduPlay primary)', () => {
    const { container } = render(
      <StatCard label="Active" value={12} icon="Lightning" tone="tertiary" />,
    );
    const chip = container.querySelector('[aria-hidden="true"]');
    expect(chip?.className).toContain('bg-primary/10');
    expect(chip?.className).toContain('text-primary');
  });

  it('applies secondary tone classes (mapped to EduPlay gold)', () => {
    const { container } = render(
      <StatCard label="Premii" value={3} icon="Trophy" tone="secondary" />,
    );
    const chip = container.querySelector('[aria-hidden="true"]');
    expect(chip?.className).toContain('bg-gold/10');
    expect(chip?.className).toContain('text-gold');
  });

  it('applies warning tone classes (mapped to EduPlay coral)', () => {
    const { container } = render(
      <StatCard label="Atenție" value={1} icon="Warning" tone="warning" />,
    );
    const chip = container.querySelector('[aria-hidden="true"]');
    expect(chip?.className).toContain('bg-coral/10');
    expect(chip?.className).toContain('text-coral');
  });

  it('renders EduPlay card styling with compact metric sizing', () => {
    render(<StatCard label="x" value="1" icon="Star" data-testid="stat" />);
    const card = screen.getByTestId("stat");
    expect(card.className).toContain('bg-surface-container-lowest');
    expect(card.className).toContain('border-outline-variant');
    expect(card.className).toContain('shadow-soft-sm');
    expect(card.className).toContain('rounded-xl');
    expect(card.className).toContain('min-h-[146px]');
  });

  it('marks the icon chip aria-hidden', () => {
    const { container } = render(<StatCard label="x" value="1" icon="Star" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});

describe('StatCard (kid)', () => {
  it('renders with kid variant', () => {
    render(
      <StatCard label="Premii" value={5} icon="Trophy" variant="kid" tone="secondary" />,
    );
    expect(screen.getByText('Premii')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
