import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ActivityCardMenu } from './ActivityCardMenu';

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

it('adapts activity actions to the shared ActionMenu primitive', async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();

  render(
    <MantineProvider>
      <ActivityCardMenu
        items={[{ key: 'duplicate', label: 'Duplică', icon: 'Copy', onSelect }]}
      />
    </MantineProvider>,
  );

  await user.click(screen.getByRole('button', { name: /mai multe acțiuni/i }));
  await user.click(await screen.findByRole('menuitem', { name: /duplică/i }));

  expect(onSelect).toHaveBeenCalledTimes(1);
});
