import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolbarRow } from './ToolbarRow';

const FILTERS = [
  { key: 'all', label: 'Toate' },
  { key: 'active', label: 'Active' },
] as const;

describe('ToolbarRow', () => {
  it('renders filter pills with the active state on the selected key', () => {
    render(
      <ToolbarRow
        filters={FILTERS}
        activeFilterKey="active"
        onFilterChange={() => {}}
      />,
    );
    const active = screen.getByRole('button', { name: 'Active' });
    expect(active.getAttribute('aria-pressed')).toBe('true');
    const all = screen.getByRole('button', { name: 'Toate' });
    expect(all.getAttribute('aria-pressed')).toBe('false');
  });

  it('invokes onFilterChange with the typed key when a pill is clicked', () => {
    const onFilterChange = vi.fn();
    render(
      <ToolbarRow
        filters={FILTERS}
        activeFilterKey="all"
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    expect(onFilterChange).toHaveBeenCalledWith('active');
  });

  it('renders an accessible search input that proxies onChange', () => {
    const onChange = vi.fn();
    render(
      <ToolbarRow
        search={{
          'aria-label': 'Caută o clasă',
          placeholder: 'Caută…',
          value: '',
          onChange,
        }}
      />,
    );
    const input = screen.getByRole('searchbox', { name: 'Caută o clasă' });
    fireEvent.change(input, { target: { value: 'III A' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('renders nothing when no filters, search, or trailing slot are provided', () => {
    const { container } = render(<ToolbarRow />);
    expect(container.firstChild).toBeNull();
  });
});
