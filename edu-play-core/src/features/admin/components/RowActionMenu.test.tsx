import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { RowActionMenu } from './RowActionMenu';

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

it('adapts row actions to the shared ActionMenu primitive', async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();

  render(
    <MantineProvider>
      <RowActionMenu
        triggerLabel="Acțiuni pentru Ana"
        items={[{ key: 'reset', label: 'Resetează parola', icon: 'ArrowClockwise', onSelect }]}
      />
    </MantineProvider>,
  );

  await user.click(screen.getByRole('button', { name: /acțiuni pentru ana/i }));
  await user.click(await screen.findByRole('menuitem', { name: /resetează parola/i }));

  expect(onSelect).toHaveBeenCalledTimes(1);
});
