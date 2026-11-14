import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Icon } from './Icon';

function getSvg(container: HTMLElement): SVGElement {
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('expected an SVG to be rendered');
  return svg;
}

describe('Icon', () => {
  it('renders the requested Phosphor glyph at the default 24px size', () => {
    const { container } = render(<Icon name="House" />);
    const svg = getSvg(container);
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
  });

  it('resolves the size token strings to icon-size scale stops', () => {
    const { container: xs } = render(<Icon name="House" size="xs" />);
    expect(getSvg(xs).getAttribute('width')).toBe('14');

    const { container: sm } = render(<Icon name="House" size="sm" />);
    expect(getSvg(sm).getAttribute('width')).toBe('16');

    const { container: md } = render(<Icon name="House" size="md" />);
    expect(getSvg(md).getAttribute('width')).toBe('18');

    const { container: lg } = render(<Icon name="House" size="lg" />);
    expect(getSvg(lg).getAttribute('width')).toBe('20');

    const { container: xl } = render(<Icon name="House" size="xl" />);
    expect(getSvg(xl).getAttribute('width')).toBe('24');
  });

  it('passes the requested weight through to Phosphor (fill swaps the rendered glyph)', () => {
    const { container: regular } = render(<Icon name="Heart" weight="regular" />);
    const { container: filled } = render(<Icon name="Heart" weight="fill" />);

    // Phosphor renders a different SVG path for `fill` vs `regular`, so the
    // serialised markup must differ — that's how we know the weight prop
    // actually reached the underlying icon component.
    expect(regular.innerHTML).not.toBe(filled.innerHTML);
  });

  it('marks the icon as decorative (aria-hidden) by default', () => {
    const { container } = render(<Icon name="Sparkle" />);
    expect(getSvg(container).getAttribute('aria-hidden')).toBe('true');
  });

  it('opts into accessible labelling when an aria-label is provided', () => {
    const { container } = render(<Icon name="Sparkle" aria-label="Streak bonus" />);
    const svg = getSvg(container);
    expect(svg.getAttribute('aria-hidden')).toBe('false');
    expect(svg.getAttribute('aria-label')).toBe('Streak bonus');
    expect(svg.getAttribute('role')).toBe('img');
  });

  it('forwards className and accepts a numeric pixel size', () => {
    const { container } = render(
      <Icon name="House" size={32} className="text-primary" />,
    );
    const svg = getSvg(container);
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('class') ?? '').toContain('text-primary');
  });
});
