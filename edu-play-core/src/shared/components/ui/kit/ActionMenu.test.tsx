import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionMenu, type ActionMenuItem } from './ActionMenu';

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

function renderMenu(items: ActionMenuItem[]) {
  return render(
    <MantineProvider>
      <ActionMenu triggerLabel="Acțiuni pentru rând" items={items} />
    </MantineProvider>,
  );
}

describe('ActionMenu', () => {
  it('opens a Mantine menu and calls the selected item', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderMenu([
      { key: 'edit', label: 'Editează', icon: 'Pencil', onSelect },
    ]);

    await user.click(screen.getByRole('button', { name: /acțiuni pentru rând/i }));
    await user.click(await screen.findByRole('menuitem', { name: /editează/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /editează/i })).not.toBeInTheDocument();
    });
  });

  it('keeps disabled items inert', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderMenu([
      {
        key: 'archive',
        label: 'Arhivează',
        icon: 'Archive',
        disabled: true,
        destructive: true,
        onSelect,
      },
    ]);

    await user.click(screen.getByRole('button', { name: /acțiuni pentru rând/i }));
    const item = await screen.findByRole('menuitem', { name: /arhivează/i });

    expect(item).toHaveAttribute('aria-disabled', 'true');
    await user.click(item);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
