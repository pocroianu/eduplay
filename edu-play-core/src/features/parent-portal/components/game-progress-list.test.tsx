import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameWithProgress } from '@/features/games';
import { GameProgressList } from './game-progress-list';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function createGame(overrides: Partial<GameWithProgress> = {}): GameWithProgress {
  return {
    id: 'game-1',
    title: 'Numere vesele',
    description: 'Adunări simple',
    thumbnail_url: null,
    game_url: '/games/math/index.html',
    category: 'math',
    difficulty_level: 2,
    target_age_min: 5,
    target_age_max: 7,
    estimated_duration: 10,
    learning_objectives: ['adunare'],
    is_published: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    progress: null,
    ...overrides,
  };
}

function createProgress(
  status: NonNullable<GameWithProgress['progress']>['status'],
  score: number | null = null,
): NonNullable<GameWithProgress['progress']> {
  return {
    id: `progress-${status}`,
    student_id: 'student-1',
    game_id: `game-${status}`,
    status,
    score,
    time_spent: status === 'completed' ? 420 : 60,
    attempts: 1,
    last_played_at: status === 'completed' ? '2026-06-02T08:00:00.000Z' : null,
    completed_at: status === 'completed' ? '2026-06-02T08:00:00.000Z' : null,
    data: null,
    created_at: '2026-06-01T08:00:00.000Z',
    updated_at: '2026-06-02T08:00:00.000Z',
  };
}

function renderList(games: GameWithProgress[]) {
  return render(
    <MantineProvider>
      <GameProgressList
        studentId="student-1"
        gamesWithProgress={games}
        showFilters
      />
    </MantineProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: ResizeObserverMock,
  });
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: ResizeObserverMock,
  });
});

describe('GameProgressList', () => {
  it('filters progress with Mantine Combobox-backed controls', async () => {
    const user = userEvent.setup();
    renderList([
      createGame({
        id: 'game-completed',
        title: 'Numere vesele',
        progress: createProgress('completed', 92),
      }),
      createGame({
        id: 'game-new',
        title: 'Litere noi',
        category: 'literacy',
        progress: null,
      }),
    ]);

    expect(screen.getByText('2 din 2 jocuri')).toBeInTheDocument();
    expect(screen.getByText('Numere vesele')).toBeInTheDocument();
    expect(screen.getByText('Litere noi')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /filtru/i }));
    await user.click(
      await screen.findByRole('option', { name: 'Completate', hidden: true }),
    );

    expect(screen.getByText('1 din 2 jocuri')).toBeInTheDocument();
    expect(screen.getByText('Numere vesele')).toBeInTheDocument();
    expect(screen.queryByText('Litere noi')).not.toBeInTheDocument();
  });

  it('does not declare native option elements for the parent filters', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/parent-portal/components/game-progress-list.tsx'),
      'utf8',
    );

    expect(source).not.toContain('<option');
  });
});
