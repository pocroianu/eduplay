import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DashboardError from './error';
import { ROUTES } from '@/shared/lib/constants/routes';

function renderError(reset = vi.fn()) {
  vi.spyOn(console, 'error').mockImplementation(() => {});

  render(
    <MantineProvider>
      <DashboardError error={new Error('boom')} reset={reset} />
    </MantineProvider>,
  );

  return { reset };
}

describe('DashboardError', () => {
  it('uses Mantine actions for retry and home navigation', async () => {
    const user = userEvent.setup();
    const { reset } = renderError();

    const retry = screen.getByRole('button', { name: /încearcă din nou/i });
    expect(retry).toHaveClass('mantine-Button-root');

    await user.click(retry);

    expect(reset).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /pagina principală/i })).toHaveAttribute(
      'href',
      ROUTES.HOME,
    );
  });
});
