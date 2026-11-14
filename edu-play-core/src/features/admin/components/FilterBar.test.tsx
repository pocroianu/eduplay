import { MantineProvider } from '@mantine/core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { FilterBar, type FilterChip } from './FilterBar';

type StatusFilter = 'all' | 'active' | 'suspended';

const chips: FilterChip<StatusFilter>[] = [
  { value: 'all', label: 'Toți', count: 3 },
  { value: 'active', label: 'Activi', count: 2 },
  { value: 'suspended', label: 'Suspendați', count: 1 },
];

it('renders search and filter chips as a pressed-button group', async () => {
  const user = userEvent.setup();
  const onSearchChange = vi.fn();
  const onChipChange = vi.fn();

  render(
    <MantineProvider>
    <FilterBar<StatusFilter>
      searchValue=""
      onSearchChange={onSearchChange}
      searchLabel="Caută utilizatori"
      chips={chips}
      activeChip="all"
      onChipChange={onChipChange}
    />
    </MantineProvider>,
  );

  await user.type(screen.getByRole('searchbox', { name: /caută utilizatori/i }), 'ana');
  expect(onSearchChange).toHaveBeenLastCalledWith('a');

  const group = screen.getByRole('group', { name: /filtrează/i });
  expect(within(group).getByRole('button', { name: /toți/i })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.queryByRole('tablist', { name: /filtrează/i })).not.toBeInTheDocument();

  await user.click(within(group).getByRole('button', { name: /suspendați/i }));
  expect(onChipChange).toHaveBeenCalledWith('suspended');
});
