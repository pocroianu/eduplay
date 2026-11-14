import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { render } from '@/../tests/test-utils';
import { StudentStatusBadge } from '@/features/teacher-dashboard/components/StudentStatusBadge';

/**
 * Component tests for StudentStatusBadge
 * Verifies correct label rendering for each status value
 */
describe('StudentStatusBadge', () => {
  it('renders "Online" label for online status', () => {
    render(<StudentStatusBadge status="online" />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('renders "Nevoie de Ajutor" label for needs_help status', () => {
    render(<StudentStatusBadge status="needs_help" />);
    expect(screen.getByText('Nevoie de Ajutor')).toBeInTheDocument();
  });

  it('renders "Offline" label for offline status', () => {
    render(<StudentStatusBadge status="offline" />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders a status dot indicator alongside the label', () => {
    const { container } = render(<StudentStatusBadge status="online" />);
    // The dot is a span inside the badge span
    const spans = container.querySelectorAll('span span');
    expect(spans.length).toBeGreaterThan(0);
  });

  it('applies correct badge class for online status', () => {
    const { container } = render(<StudentStatusBadge status="online" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-primary/10');
    expect(badge?.className).toContain('text-primary');
  });

  it('applies correct badge class for needs_help status', () => {
    const { container } = render(<StudentStatusBadge status="needs_help" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-coral/10');
    expect(badge?.className).toContain('text-coral');
  });

  it('applies correct badge class for offline status', () => {
    const { container } = render(<StudentStatusBadge status="offline" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-on-surface-variant/10');
  });
});
