import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  useReducedMotion: () => false,
}));

import { Vulpita } from './Vulpita';

describe('Vulpita', () => {
  it('renders with default props (idle mood)', () => {
    render(<Vulpita />);
    const img = screen.getByRole('img', { name: /vulpi/i });
    expect(img).toBeInTheDocument();
  });

  it('has default aria-label per §3.7 spec', () => {
    render(<Vulpita />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('aria-label', 'Vulpița, vulpea EduPlay');
  });

  it('allows custom ariaLabel', () => {
    render(<Vulpita ariaLabel="Mascotă" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('aria-label', 'Mascotă');
  });

  it.each(['idle', 'happy', 'cheer', 'think', 'sad', 'sleep'] as const)(
    'renders mood=%s without crashing',
    (mood) => {
      const { container } = render(<Vulpita mood={mood} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    },
  );

  it('respects size prop on the SVG', () => {
    const { container } = render(<Vulpita size={200} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '200');
    expect(svg).toHaveAttribute('height', '200');
  });

  it('defaults to size 120', () => {
    const { container } = render(<Vulpita />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '120');
    expect(svg).toHaveAttribute('height', '120');
  });

  it('applies className to the SVG', () => {
    const { container } = render(<Vulpita className="fox-class" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('fox-class');
  });

  describe('bandana', () => {
    it('renders bandana with green (primary) fill by default', () => {
      const { container } = render(<Vulpita />);
      const bandana = container.querySelector('path[fill="var(--color-primary)"]');
      expect(bandana).toBeInTheDocument();
    });

    it('renders bandana with gold fill', () => {
      const { container } = render(<Vulpita bandana="gold" />);
      const bandana = container.querySelector('path[fill="var(--color-gold)"]');
      expect(bandana).toBeInTheDocument();
    });

    it('renders bandana with coral fill', () => {
      const { container } = render(<Vulpita bandana="coral" />);
      const bandana = container.querySelector('path[fill="var(--color-coral)"]');
      expect(bandana).toBeInTheDocument();
    });

    it('hides bandana when null', () => {
      const { container } = render(<Vulpita bandana={null} />);
      const primaryBandana = container.querySelector('path[fill="var(--color-primary)"]');
      const goldBandana = container.querySelector('path[fill="var(--color-gold)"]');
      const coralBandana = container.querySelector('path[fill="var(--color-coral)"]');
      expect(primaryBandana).not.toBeInTheDocument();
      expect(goldBandana).not.toBeInTheDocument();
      expect(coralBandana).not.toBeInTheDocument();
    });
  });

  describe('CSS var theming', () => {
    it('uses CSS vars instead of raw hex for fur fills', () => {
      const { container } = render(<Vulpita />);
      const furFill = container.querySelector('circle[fill="var(--color-vulpita-fur)"]');
      expect(furFill).toBeInTheDocument();
    });

    it('uses --color-ink for dark fills', () => {
      const { container } = render(<Vulpita />);
      const inkFills = container.querySelectorAll('[fill="var(--color-ink)"]');
      expect(inkFills.length).toBeGreaterThan(0);
    });

    it('uses --color-coral for cheek blush', () => {
      const { container } = render(<Vulpita />);
      const cheeks = container.querySelectorAll('circle[fill="var(--color-coral)"]');
      expect(cheeks.length).toBe(2);
    });
  });
});
