import { MantineProvider } from '@mantine/core';
import type { ReactElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterChipGroup } from './FilterChipGroup';

const items = [
  { value: 'all', label: 'Toate', count: 8 },
  { value: 'draft', label: 'Ciorne', count: 2 },
  { value: 'published', label: 'Publicate', count: 6 },
];

describe('FilterChipGroup', () => {
  function renderGroup(element: ReactElement) {
    return render(<MantineProvider>{element}</MantineProvider>);
  }

  it('renders filter chips as a pressed-button group', () => {
    renderGroup(
      <FilterChipGroup
        ariaLabel="Filtrează activități"
        items={items}
        value="all"
        onChange={() => {}}
      />,
    );

    const group = screen.getByRole('group', { name: /filtrează activități/i });
    expect(within(group).getByRole('button', { name: /toate/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: /ciorne/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(group).getByText('8')).toBeInTheDocument();
  });

  it('emits the selected value through the public onChange callback', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderGroup(
      <FilterChipGroup
        ariaLabel="Filtrează activități"
        items={items}
        value="all"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /ciorne/i }));

    expect(onChange).toHaveBeenCalledWith('draft');
  });

  it('can clear the active chip when deselection is enabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderGroup(
      <FilterChipGroup
        ariaLabel="Filtrează activități"
        items={items}
        value="all"
        onChange={onChange}
        allowDeselect
      />,
    );

    await user.click(screen.getByRole('button', { name: /toate/i }));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('supports accessible labels that differ from visible short labels', () => {
    renderGroup(
      <FilterChipGroup
        ariaLabel="Alege clasa"
        items={[{ value: 'grade-1', label: '1', ariaLabel: 'Clasa întâi' }]}
        value=""
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Clasa întâi' })).toHaveTextContent('1');
  });

  it('exposes Mantine Styles API selectors', () => {
    renderGroup(
      <FilterChipGroup
        ariaLabel="Filtrează activități"
        items={items}
        value="all"
        onChange={() => {}}
        classNames={{ root: 'test-root', chip: 'test-chip' }}
      />,
    );

    expect(screen.getByRole('group', { name: /filtrează activități/i })).toHaveClass(
      'test-root',
    );
    expect(screen.getByRole('button', { name: /toate/i })).toHaveClass('test-chip');
  });

  it('supports kid-mode 64px chips and non-wrapping rows', () => {
    renderGroup(
      <FilterChipGroup
        ariaLabel="Filtrează jocuri"
        items={items}
        value="all"
        onChange={() => {}}
        size="kid"
        wrap={false}
      />,
    );

    const group = screen.getByRole('group', { name: /filtrează jocuri/i });
    expect(group).toHaveAttribute('data-wrap', 'false');
    expect(group.style.getPropertyValue('--filter-chip-height')).toContain('4rem');
  });
});
