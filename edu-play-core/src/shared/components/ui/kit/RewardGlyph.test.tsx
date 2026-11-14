import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RewardGlyph, DuoFlame } from './RewardGlyph';

describe('RewardGlyph', () => {
  it.each(['heart', 'gem', 'xp', 'trophy', 'flame'] as const)(
    'renders an SVG for kind=%s',
    (kind) => {
      const { container } = render(<RewardGlyph kind={kind} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    },
  );

  it.each(['heart', 'gem', 'xp', 'trophy'] as const)(
    'SVG for kind=%s has aria-hidden="true"',
    (kind) => {
      const { container } = render(<RewardGlyph kind={kind} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    },
  );

  it('flame glyph SVG has aria-hidden="true"', () => {
    const { container } = render(<RewardGlyph kind="flame" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies custom size', () => {
    const { container } = render(<RewardGlyph kind="heart" size={48} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
  });

  it('applies className', () => {
    const { container } = render(<RewardGlyph kind="gem" className="my-glyph" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('my-glyph');
  });
});

describe('DuoFlame', () => {
  it('renders with coral fill when on=true (default)', () => {
    const { container } = render(<DuoFlame />);
    const paths = container.querySelectorAll('path');
    expect(paths[0]).toHaveAttribute('fill', 'var(--color-coral)');
  });

  it('renders with gray fill when on=false', () => {
    const { container } = render(<DuoFlame on={false} />);
    const paths = container.querySelectorAll('path');
    expect(paths[0]).toHaveAttribute('fill', 'var(--color-outline)');
  });

  it('inner path uses gold when on', () => {
    const { container } = render(<DuoFlame on />);
    const paths = container.querySelectorAll('path');
    expect(paths[1]).toHaveAttribute('fill', 'var(--color-gold)');
  });

  it('inner path uses light gray when off', () => {
    const { container } = render(<DuoFlame on={false} />);
    const paths = container.querySelectorAll('path');
    expect(paths[1]).toHaveAttribute('fill', 'var(--color-outline-variant)');
  });

  it('has aria-hidden="true"', () => {
    const { container } = render(<DuoFlame />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
