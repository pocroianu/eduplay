import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BackgroundGlyph } from './BackgroundGlyph';

describe('BackgroundGlyph', () => {
  it.each(['squiggle', 'dotGrid', 'blob'] as const)(
    'renders an SVG for kind=%s',
    (kind) => {
      const { container } = render(<BackgroundGlyph kind={kind} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    },
  );

  it.each(['squiggle', 'dotGrid', 'blob'] as const)(
    'kind=%s SVG is aria-hidden so it cannot leak into accessibility tree',
    (kind) => {
      const { container } = render(<BackgroundGlyph kind={kind} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    },
  );

  it('squiggle uses tone color on the stroke (green default)', () => {
    const { container } = render(<BackgroundGlyph kind="squiggle" />);
    const path = container.querySelector('path');
    expect(path).toHaveAttribute('stroke', 'var(--color-primary)');
  });

  it('blob uses tone color on the fill', () => {
    const { container } = render(<BackgroundGlyph kind="blob" tone="coral" />);
    const path = container.querySelector('path');
    expect(path).toHaveAttribute('fill', 'var(--color-coral)');
  });

  it('dotGrid renders 36 circles colored by tone', () => {
    const { container } = render(<BackgroundGlyph kind="dotGrid" tone="purple" />);
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(36);
    const group = container.querySelector('g');
    expect(group).toHaveAttribute('fill', 'var(--color-purple)');
  });

  it('respects size prop', () => {
    const { container } = render(<BackgroundGlyph kind="blob" size={240} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '240');
    expect(svg).toHaveAttribute('height', '240');
  });

  it('default opacity makes the glyph quiet', () => {
    const { container } = render(<BackgroundGlyph kind="blob" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveStyle({ opacity: '0.18' });
  });

  it('opacity is overridable', () => {
    const { container } = render(<BackgroundGlyph kind="blob" opacity={0.4} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveStyle({ opacity: '0.4' });
  });

  it('forwards className', () => {
    const { container } = render(
      <BackgroundGlyph kind="squiggle" className="bg-glyph" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('bg-glyph');
  });
});
