import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';
import { STANDARD_BUTTON_INTERACTION_CLASS } from './interactionTokens';

describe('Button (standard mode)', () => {
  it('renders children and handles click', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    const btn = screen.getByRole('button', { name: /click me/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('uses EduPlay standard chrome without scale-hover behavior', () => {
    render(<Button variant="secondary">Sign in</Button>);
    const button = screen.getByRole('button', { name: /sign in/i });
    const className = button.getAttribute('class') ?? '';

    expect(className).toContain('bg-surface-container-lowest');
    expect(className).toContain('rounded-md');
    expect(className).toContain('shadow-soft-sm');
    expect(className).not.toContain('active:translate-y-px');
    expect(className).not.toContain('shadow-chunk-green');
    expect(className).not.toContain('uppercase');
    expect(className).not.toMatch(/hover:scale-|group-hover:scale-/);
    expect(className).toContain(STANDARD_BUTTON_INTERACTION_CLASS);
    expect(className).not.toContain(
      'transition-[background-color,color,box-shadow,transform]',
    );
  });

  it('renders a Link when href is provided', () => {
    render(
      <Button href="/login" variant="primary">
        Sign in
      </Button>,
    );
    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('applies fullWidth class when requested', () => {
    render(<Button fullWidth>Wide</Button>);
    expect(screen.getByRole('button', { name: /wide/i })).toHaveClass('w-full');
  });

  it('is disabled when isPending is true', () => {
    render(<Button isPending>Loading</Button>);
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
  });

  it('keeps small standard controls at the 44px target floor', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);

    expect(screen.getByRole('button', { name: /small/i })).toHaveClass('min-h-11');

    rerender(
      <Button size="sm" variant="icon">
        Meniu
      </Button>,
    );

    const iconButton = screen.getByRole('button', { name: /meniu/i });
    expect(iconButton).toHaveClass('h-11');
    expect(iconButton).toHaveClass('w-11');
  });

  it('respects disabled prop', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Off
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: /off/i }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('blocks navigation on a disabled link button', () => {
    // `<Link aria-disabled>` is announced by screen readers but does not stop
    // mouse/touch clicks. Disabled CTAs that render as links must also drop
    // pointer events and remove themselves from the tab order, otherwise a
    // teacher clicking Preview mid-save can navigate away and lose work.
    render(
      <Button href="/preview" disabled>
        Preview
      </Button>,
    );
    const link = screen.getByRole('link', { name: /preview/i });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabIndex', '-1');
    expect(link).toHaveStyle({ pointerEvents: 'none' });
  });

  it('does not block navigation on an enabled link button', () => {
    render(<Button href="/preview">Preview</Button>);
    const link = screen.getByRole('link', { name: /preview/i });
    expect(link).not.toHaveAttribute('aria-disabled');
    expect(link).not.toHaveAttribute('tabIndex');
    expect(link.style.pointerEvents).toBe('');
  });
});

describe('Button (kid mode)', () => {
  it('blocks disabled kid links for pointer and keyboard activation', () => {
    const onClick = vi.fn();
    render(<Button mode="kid" href="/preview" isPending onClick={onClick}>Preview</Button>);
    const link = screen.getByRole('link', { name: 'Preview' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');
    expect(link).toHaveAttribute('aria-busy', 'true');
    expect(fireEvent.click(link)).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards link attributes and keyboard handlers to the anchor', () => {
    const onKeyDown = vi.fn();
    render(<Button mode="kid" href="/preview" data-testid="preview" onKeyDown={onKeyDown}>Preview</Button>);
    fireEvent.keyDown(screen.getByTestId('preview'), { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalledOnce();
  });

  it('renders a button with depth face color when tone=lime', () => {
    render(
      <Button mode="kid" tone="lime">
        Go
      </Button>,
    );
    const btn = screen.getByRole('button', { name: /go/i });
    expect(btn).toBeInTheDocument();
  });

  it('uses default lime tone for primary variant', () => {
    render(
      <Button mode="kid" variant="primary">
        Primary
      </Button>,
    );
    expect(
      screen.getByRole('button', { name: /primary/i }),
    ).toBeInTheDocument();
  });
  it('keeps kid large buttons at the 64px touch-target floor', () => {
    render(
      <Button mode="kid" size="lg">
        Repetă
      </Button>,
    );

    const button = screen.getByRole('button', { name: /repetă/i });
    expect(button).toHaveStyle({ minHeight: '64px', minWidth: '64px' });
  });

  it('clamps kid small buttons to the 64px touch-target floor', () => {
    render(
      <Button mode="kid" size="sm">
        Start
      </Button>,
    );

    const button = screen.getByRole('button', { name: /start/i });
    expect(button).toHaveStyle({ minHeight: '64px', minWidth: '64px' });
  });

  it('renders as link with href', () => {
    render(
      <Button mode="kid" tone="cream" href="/register">
        Start
      </Button>,
    );
    expect(screen.getByRole('link', { name: /start/i })).toHaveAttribute(
      'href',
      '/register',
    );
  });
});

describe('Button (legacy ink tone)', () => {
  it('renders the kid ink tone as neutral chrome instead of black chrome', () => {
    render(
      <Button mode="kid" tone="ink">
        Înapoi
      </Button>,
    );

    const button = screen.getByRole('button', { name: /înapoi/i });
    expect(button).toHaveStyle({
      backgroundColor: 'var(--color-surface-container)',
      color: 'var(--color-on-surface)',
    });
    expect(button).not.toHaveStyle({
      backgroundColor: 'var(--color-on-surface)',
      color: 'var(--color-surface)',
    });
  });
});
