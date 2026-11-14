import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children with standard defaults', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('applies kid-mode border via inline style when mode=kid', () => {
    const { container } = render(
      <Badge mode="kid" tone="success">
        Live
      </Badge>,
    );
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.style.border).toContain('2px');
  });

  it('renders danger tone with Seesaw error-soft classes', () => {
    render(<Badge tone="danger">Err</Badge>);
    const badge = screen.getByText('Err');
    expect(badge.className).toContain('bg-error-soft');
    expect(badge.className).toContain('text-error');
    expect(badge.className).not.toContain('text-coral-deep');
  });
});
