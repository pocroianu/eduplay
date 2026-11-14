import { MantineProvider } from '@mantine/core';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChildDetailContent } from './ChildDetailContent';

vi.mock('./activity-feed', () => ({
  ActivityFeed: () => <div data-testid="activity-panel" />,
}));

vi.mock('./game-progress-list', () => ({
  GameProgressList: ({ showFilters }: { showFilters?: boolean }) => (
    <div data-testid={showFilters ? 'progress-panel' : 'games-panel'} />
  ),
}));

function renderChildDetail() {
  return render(
    <MantineProvider>
      <ChildDetailContent
        profile={{
          id: 'parent-1',
          full_name: 'Părinte Test',
          email: 'parent@example.com',
          role: 'parent',
          avatar_url: null,
        }}
        child={{
          id: 'child-1',
          name: 'ana.pop',
          avatarUrl: null,
          createdAt: '2026-05-01T09:00:00.000Z',
        }}
        stats={{
          totalGamesPlayed: 0,
          completedGames: 1,
          inProgressGames: 2,
          averageScore: 80,
          totalPlayTime: 0,
          lastActivityAt: null,
        }}
        gamesWithProgress={[]}
        recentActivity={[]}
        consents={{}}
      />
    </MantineProvider>,
  );
}

describe('ChildDetailContent', () => {
  it('uses Mantine tab semantics for child detail navigation', async () => {
    const user = userEvent.setup();
    renderChildDetail();

    expect(
      screen.getByRole('tablist', { name: /navigare detalii copil/i }),
    ).toBeInTheDocument();

    const progressTab = screen.getByRole('tab', { name: /progres/i });
    const activityTab = screen.getByRole('tab', { name: /activitate/i });

    expect(progressTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /rezumat progres/i })).toBeInTheDocument();
    expect(screen.getByTestId('progress-panel')).toBeInTheDocument();

    await user.click(activityTab);

    expect(activityTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /fir de activitate/i })).toBeInTheDocument();
    expect(screen.getByTestId('activity-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-panel')).toBeNull();
  });
});
