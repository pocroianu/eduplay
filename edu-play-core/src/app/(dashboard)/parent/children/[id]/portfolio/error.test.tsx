import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ROUTES } from '@/shared/lib/constants/routes';
import ParentChildPortfolioError from './error';

describe('/parent/children/[id]/portfolio error', () => {
  it('renders the dashboard CTA as a link instead of a nested button', () => {
    render(
      <ParentChildPortfolioError
        error={new Error('boom')}
        reset={vi.fn()}
      />,
    );

    const link = screen.getByRole('link', { name: /înapoi la panou/i });
    expect(link).toHaveAttribute('href', ROUTES.PARENT.DASHBOARD);
    expect(screen.queryByRole('button', { name: /înapoi la panou/i })).toBeNull();
  });
});
