import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ParentLinkChildError from './error';

function renderError(reset = vi.fn()) {
  render(
    <MantineProvider>
      <ParentLinkChildError error={new Error('boom')} reset={reset} />
    </MantineProvider>,
  );

  return { reset };
}

describe('ParentLinkChildError', () => {
  it('uses a Mantine retry button that calls reset', async () => {
    const user = userEvent.setup();
    const { reset } = renderError();

    const retry = screen.getByRole('button', { name: /încearcă din nou/i });
    expect(retry).toHaveClass('mantine-Button-root');

    await user.click(retry);

    expect(reset).toHaveBeenCalled();
  });
});
