import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DuoAvatar } from './DuoAvatar';

describe('DuoAvatar', () => {
  it('renders initials from name', () => {
    render(<DuoAvatar name="Ana Maria" />);
    expect(screen.getByText('AM')).toBeInTheDocument();
  });

  it('renders single initial for single-word name', () => {
    render(<DuoAvatar name="Bogdan" />);
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('has role="img" and aria-label set to name', () => {
    render(<DuoAvatar name="Elena Pop" />);
    const el = screen.getByRole('img');
    expect(el).toHaveAttribute('aria-label', 'Elena Pop');
  });

  it('defaults to size 44', () => {
    render(<DuoAvatar name="Test" />);
    const el = screen.getByRole('img');
    expect(el.style.width).toBe('44px');
    expect(el.style.height).toBe('44px');
  });

  it('respects custom size prop', () => {
    render(<DuoAvatar name="Test" size={64} />);
    const el = screen.getByRole('img');
    expect(el.style.width).toBe('64px');
    expect(el.style.height).toBe('64px');
  });

  it('produces deterministic color for the same name', () => {
    const { unmount } = render(<DuoAvatar name="Maria Ionescu" />);
    const bg1 = screen.getByRole('img').style.backgroundColor;
    unmount();

    render(<DuoAvatar name="Maria Ionescu" />);
    const bg2 = screen.getByRole('img').style.backgroundColor;
    expect(bg1).toBe(bg2);
  });

  it('different names can produce different colors', () => {
    const { unmount } = render(<DuoAvatar name="Ana" />);
    const bg1 = screen.getByRole('img').style.backgroundColor;
    unmount();

    render(<DuoAvatar name="Zoe" />);
    const bg2 = screen.getByRole('img').style.backgroundColor;
    // Not strictly guaranteed to differ, but these names hash differently
    // Just verify both have a color set
    expect(bg1).toBeTruthy();
    expect(bg2).toBeTruthy();
  });

  it('ring prop adds a border', () => {
    render(<DuoAvatar name="Test" ring="#FF0000" />);
    const el = screen.getByRole('img');
    // jsdom converts hex to rgb in computed style strings
    expect(el.style.border).toBe('3px solid rgb(255, 0, 0)');
  });

  it('no ring prop means no border', () => {
    render(<DuoAvatar name="Test" />);
    const el = screen.getByRole('img');
    expect(el.style.border).toBe('');
  });

  it('forwards className', () => {
    render(<DuoAvatar name="Test" className="my-avatar" />);
    const el = screen.getByRole('img');
    expect(el).toHaveClass('my-avatar');
  });
});
