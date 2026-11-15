import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChunkyButton } from './ChunkyButton';

describe('ChunkyButton', () => {
  it('renders with default props (green, md)', () => {
    render(<ChunkyButton>Start</ChunkyButton>);
    const btn = screen.getByRole('button', { name: /start/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('bg-primary');
    expect(btn).toHaveClass('text-white');
    expect(btn).toHaveClass('py-3');
  });

  it.each([
    ['green', 'bg-primary'],
    ['gold', 'bg-gold'],
    ['blue', 'bg-blue'],
    ['coral', 'bg-coral'],
    ['purple', 'bg-purple'],
    ['pink', 'bg-pink'],
    ['ghost', 'bg-white'],
    ['ink', 'bg-surface-container'],
  ] as const)('renders variant=%s with class %s', (variant, expectedClass) => {
    render(<ChunkyButton variant={variant}>Btn</ChunkyButton>);
    expect(screen.getByRole('button', { name: /btn/i })).toHaveClass(expectedClass);
  });

  it('uses EduPlay flat chrome instead of tonal chunky borders', () => {
    render(<ChunkyButton>Btn</ChunkyButton>);
    const button = screen.getByRole('button', { name: /btn/i });

    expect(button).toHaveClass('shadow-soft-sm');
    expect(button).not.toHaveClass('border-2');
    expect(button).not.toHaveClass('border-primary-dim');
  });

  it('keeps the legacy ink variant neutral instead of black-framed chrome', () => {
    render(<ChunkyButton variant="ink">Ink</ChunkyButton>);

    const button = screen.getByRole('button', { name: /ink/i });
    expect(button).toHaveClass('bg-surface-container');
    expect(button).toHaveClass('shadow-soft-sm');
    expect(button).toHaveClass('text-ink');
    expect(button).not.toHaveClass('bg-ink');
    expect(button).not.toHaveClass('border-ink-shadow');
  });

  it.each([
    ['sm', 'py-2', 'text-body-sm', 'rounded-md'],
    ['md', 'py-3', 'text-body', 'rounded-md'],
    ['lg', 'py-4', 'text-title', 'rounded-lg'],
  ] as const)(
    'renders size=%s with padding %s, font %s, radius %s',
    (size, paddingClass, fontClass, radiusClass) => {
      render(<ChunkyButton size={size}>Btn</ChunkyButton>);
      const btn = screen.getByRole('button', { name: /btn/i });
      expect(btn).toHaveClass(paddingClass);
      expect(btn).toHaveClass(fontClass);
      expect(btn).toHaveClass(radiusClass);
    },
  );

  it('keeps standard button copy in sentence case at every size', () => {
    const { rerender } = render(<ChunkyButton size="md">Md</ChunkyButton>);
    expect(screen.getByRole('button', { name: /md/i })).not.toHaveClass('uppercase');
    rerender(<ChunkyButton size="lg">Lg</ChunkyButton>);
    expect(screen.getByRole('button', { name: /lg/i })).not.toHaveClass('uppercase');
    rerender(<ChunkyButton size="sm">Sm</ChunkyButton>);
    expect(screen.getByRole('button', { name: /sm/i })).not.toHaveClass('uppercase');
  });

  it('renders left and right icons by name', () => {
    render(
      <ChunkyButton icon="House" iconRight="ArrowRight">
        Middle
      </ChunkyButton>,
    );
    const btn = screen.getByRole('button', { name: /middle/i });
    // Phosphor renders an SVG; assert two icon SVGs present.
    expect(btn.querySelectorAll('svg').length).toBe(2);
  });

  it('applies full width class when full prop is true', () => {
    render(<ChunkyButton full>Wide</ChunkyButton>);
    expect(screen.getByRole('button', { name: /wide/i })).toHaveClass('w-full');
  });

  it('applies opacity-50 and disables when disabled prop is set', () => {
    render(<ChunkyButton disabled>Off</ChunkyButton>);
    const btn = screen.getByRole('button', { name: /off/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveClass('opacity-50');
    expect(btn).toHaveClass('cursor-not-allowed');
  });

  it('renders spinner, sets aria-busy, and disables when loading', () => {
    render(<ChunkyButton loading>Submit</ChunkyButton>);
    const btn = screen.getByRole('button', { name: /submit/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toHaveClass('opacity-50');
    // The spinner wrapper carries the animate-spin class.
    expect(btn.querySelector('.animate-spin')).not.toBeNull();
    // Spinner replaces the icon — only one SVG.
    expect(btn.querySelectorAll('svg').length).toBe(1);
  });

  it('does not set aria-busy when loading is false', () => {
    render(<ChunkyButton>Idle</ChunkyButton>);
    expect(screen.getByRole('button', { name: /idle/i })).not.toHaveAttribute('aria-busy');
  });

  it('hides iconRight while loading', () => {
    render(
      <ChunkyButton loading icon="House" iconRight="ArrowRight">
        Submit
      </ChunkyButton>,
    );
    const btn = screen.getByRole('button', { name: /submit/i });
    // Only the spinner SVG; both icon and iconRight are suppressed.
    expect(btn.querySelectorAll('svg').length).toBe(1);
  });

  it('forwards onClick handler', () => {
    const onClick = vi.fn();
    render(<ChunkyButton onClick={onClick}>Go</ChunkyButton>);
    fireEvent.click(screen.getByRole('button', { name: /go/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    render(
      <ChunkyButton disabled onClick={onClick}>
        Off
      </ChunkyButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: /off/i }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not fire onClick when loading', () => {
    const onClick = vi.fn();
    render(
      <ChunkyButton loading onClick={onClick}>
        Saving
      </ChunkyButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: /saving/i }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards type="submit"', () => {
    render(<ChunkyButton type="submit">Send</ChunkyButton>);
    expect(screen.getByRole('button', { name: /send/i })).toHaveAttribute('type', 'submit');
  });

  it('defaults to type="button"', () => {
    render(<ChunkyButton>Click</ChunkyButton>);
    expect(screen.getByRole('button', { name: /click/i })).toHaveAttribute('type', 'button');
  });

  it('exposes a focus-visible ring', () => {
    render(<ChunkyButton>Focus</ChunkyButton>);
    const btn = screen.getByRole('button', { name: /focus/i });
    expect(btn).toHaveClass('focus-visible:ring-2');
    expect(btn).toHaveClass('focus-visible:ring-primary');
    expect(btn).toHaveClass('focus-visible:ring-offset-2');
  });

  describe('as link (href set)', () => {
    it('renders an <a> with the href when href is provided', () => {
      render(<ChunkyButton href="/register">Sign up</ChunkyButton>);
      const link = screen.getByRole('link', { name: /sign up/i });
      expect(link).toBeInTheDocument();
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/register');
    });

    it('does not render a <button> when href is set', () => {
      render(<ChunkyButton href="/x">Go</ChunkyButton>);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it.each([
      ['green', 'bg-primary'],
      ['gold', 'bg-gold'],
      ['blue', 'bg-blue'],
      ['coral', 'bg-coral'],
      ['purple', 'bg-purple'],
      ['pink', 'bg-pink'],
      ['ghost', 'bg-white'],
      ['ink', 'bg-surface-container'],
    ] as const)('renders link variant=%s with class %s', (variant, expectedClass) => {
      render(
        <ChunkyButton href="/x" variant={variant}>
          Go
        </ChunkyButton>,
      );
      expect(screen.getByRole('link', { name: /go/i })).toHaveClass(expectedClass);
    });

    it.each([
      ['sm', 'py-2', 'text-body-sm', 'rounded-md'],
      ['md', 'py-3', 'text-body', 'rounded-md'],
      ['lg', 'py-4', 'text-title', 'rounded-lg'],
    ] as const)(
      'renders link size=%s with padding %s, font %s, radius %s',
      (size, paddingClass, fontClass, radiusClass) => {
        render(
          <ChunkyButton href="/x" size={size}>
            Go
          </ChunkyButton>,
        );
        const link = screen.getByRole('link', { name: /go/i });
        expect(link).toHaveClass(paddingClass);
        expect(link).toHaveClass(fontClass);
        expect(link).toHaveClass(radiusClass);
      },
    );

    it('uses text-ink on link branch for pink variant', () => {
      render(
        <ChunkyButton href="/x" variant="pink">
          Pink
        </ChunkyButton>,
      );
      expect(screen.getByRole('link', { name: /pink/i })).toHaveClass('text-ink');
    });

    it('renders icon and iconRight by name on link branch', () => {
      render(
        <ChunkyButton href="/x" icon="House" iconRight="ArrowRight">
          Middle
        </ChunkyButton>,
      );
      const link = screen.getByRole('link', { name: /middle/i });
      expect(link.querySelectorAll('svg').length).toBe(2);
    });

    it('applies full width on link branch when full prop is true', () => {
      render(
        <ChunkyButton href="/x" full>
          Wide
        </ChunkyButton>,
      );
      expect(screen.getByRole('link', { name: /wide/i })).toHaveClass('w-full');
    });

    it('keeps standard link button copy in sentence case at every size', () => {
      const { rerender } = render(
        <ChunkyButton href="/x" size="md">
          Md
        </ChunkyButton>,
      );
      expect(screen.getByRole('link', { name: /md/i })).not.toHaveClass('uppercase');
      rerender(
        <ChunkyButton href="/x" size="lg">
          Lg
        </ChunkyButton>,
      );
      expect(screen.getByRole('link', { name: /lg/i })).not.toHaveClass('uppercase');
      rerender(
        <ChunkyButton href="/x" size="sm">
          Sm
        </ChunkyButton>,
      );
      expect(screen.getByRole('link', { name: /sm/i })).not.toHaveClass('uppercase');
    });

    it('exposes the same focus-visible ring classes on link branch', () => {
      render(<ChunkyButton href="/x">Focus</ChunkyButton>);
      const link = screen.getByRole('link', { name: /focus/i });
      expect(link).toHaveClass('focus-visible:ring-2');
      expect(link).toHaveClass('focus-visible:ring-primary');
      expect(link).toHaveClass('focus-visible:ring-offset-2');
    });

    it('does not throw on pointer/touch press events on link branch', () => {
      render(<ChunkyButton href="/x">Press</ChunkyButton>);
      const link = screen.getByRole('link', { name: /press/i });
      expect(() => {
        fireEvent.pointerDown(link);
        fireEvent.pointerUp(link);
        fireEvent.touchStart(link);
        fireEvent.touchEnd(link);
      }).not.toThrow();
    });
  });
});
