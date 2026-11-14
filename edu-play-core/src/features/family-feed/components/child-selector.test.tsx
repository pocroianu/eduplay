import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChildSelector } from './child-selector';

const replace = vi.fn();

vi.mock('next/navigation', async () => {
  const actual: object = await vi.importActual('next/navigation');
  return {
    ...actual,
    useRouter: () => ({
      replace,
      push: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    }),
    usePathname: () => '/parent',
    useSearchParams: () => new URLSearchParams('utm=x'),
  };
});

const OPTIONS = [
  { id: 'a', name: 'Ana' },
  { id: 'b', name: 'Bogdan' },
];

beforeEach(() => {
  replace.mockReset();
});

describe('ChildSelector', () => {
  it('renders an "all children" pill plus one pill per child', () => {
    render(
      <ChildSelector childOptions={OPTIONS} selectedChildId={null} />,
    );
    expect(
      screen.getByRole('button', { name: 'Toți copiii' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bogdan' })).toBeInTheDocument();
  });

  it('marks the active option via aria-pressed and data-active', () => {
    render(<ChildSelector childOptions={OPTIONS} selectedChildId="a" />);
    const ana = screen.getByRole('button', { name: 'Ana' });
    const bogdan = screen.getByRole('button', { name: 'Bogdan' });
    const all = screen.getByRole('button', { name: 'Toți copiii' });
    expect(ana.getAttribute('aria-pressed')).toBe('true');
    expect(ana.getAttribute('data-active')).toBe('true');
    expect(bogdan.getAttribute('aria-pressed')).toBe('false');
    expect(all.getAttribute('aria-pressed')).toBe('false');
  });

  it('writes the selected child id into ?child while preserving other params', async () => {
    render(
      <ChildSelector childOptions={OPTIONS} selectedChildId={null} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Bogdan' }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/parent?utm=x&child=b', {
      scroll: false,
    });
  });

  it('removes the ?child param when "all children" is clicked', async () => {
    render(<ChildSelector childOptions={OPTIONS} selectedChildId="a" />);
    await userEvent.click(screen.getByRole('button', { name: 'Toți copiii' }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/parent?utm=x', { scroll: false });
  });

  it('respects an explicit onChange override (no router calls)', async () => {
    const onChange = vi.fn();
    render(
      <ChildSelector
        childOptions={OPTIONS}
        selectedChildId={null}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ana' }));
    expect(onChange).toHaveBeenCalledWith('a');
    expect(replace).not.toHaveBeenCalled();
  });
});
