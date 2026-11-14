import { MantineProvider } from '@mantine/core';
import type { ReactElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterSelect } from './FilterSelect';

const options = [
  { value: 'newest', label: 'Cele mai noi' },
  { value: 'difficulty', label: 'Dificultate' },
  { value: 'age', label: 'Vârstă' },
];

function renderSelect(element: ReactElement) {
  return render(<MantineProvider>{element}</MantineProvider>);
}

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: TestResizeObserver,
  });
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: TestResizeObserver,
  });
});

describe('FilterSelect', () => {
  it('renders a Combobox-backed button target with the selected value', () => {
    renderSelect(
      <FilterSelect
        label="Sortează"
        options={options}
        value="newest"
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /sortează/i })).toHaveTextContent(
      'Cele mai noi',
    );
  });

  it('emits the selected option value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderSelect(
      <FilterSelect
        ariaLabel="Sortează activitățile"
        options={options}
        value="newest"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /sortează activitățile/i }));
    await user.click(
      await screen.findByRole('option', { name: /dificultate/i, hidden: true }),
    );

    expect(onChange).toHaveBeenCalledWith('difficulty');
  });

  it('exposes Mantine Styles API selectors', async () => {
    const user = userEvent.setup();

    const { container } = renderSelect(
      <FilterSelect
        ariaLabel="Sortează activitățile"
        options={options}
        value="newest"
        onChange={() => {}}
        classNames={{ root: 'test-root', option: 'test-option' }}
      />,
    );

    expect(container.querySelector('.test-root')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sortează activitățile/i }));
    expect(
      within(await screen.findByRole('listbox', { hidden: true })).getByRole('option', {
        name: /vârstă/i,
        hidden: true,
      }),
    ).toHaveClass('test-option');
  });
});
