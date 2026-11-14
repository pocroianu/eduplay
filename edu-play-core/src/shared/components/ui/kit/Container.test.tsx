import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Container } from './Container';

describe('Container', () => {
  it('renders as <div> by default', () => {
    const { container } = render(<Container>hi</Container>);
    expect(container.firstElementChild?.tagName).toBe('DIV');
  });

  it('renders as the requested semantic tag', () => {
    render(
      <Container as="section" data-testid="c">
        content
      </Container>,
    );
    expect(screen.getByTestId('c').tagName).toBe('SECTION');
  });

  it('applies the requested max-width class', () => {
    render(
      <Container width="narrow" data-testid="c">
        x
      </Container>,
    );
    expect(screen.getByTestId('c')).toHaveClass('max-w-3xl');
  });

  it('removes horizontal padding when padding=none', () => {
    render(
      <Container padding="none" data-testid="c">
        x
      </Container>,
    );
    const el = screen.getByTestId('c');
    expect(el.className).not.toContain('px-6');
  });
});
