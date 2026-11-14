import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import { TeacherGamesPageContent } from './TeacherGamesPageContent';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const game = {
  id: 'game-1',
  title: 'Litere magice',
  description: 'Potrivește sunetele cu literele.',
  template: 'matching-game',
  thumbnail_url: null,
  game_url: '/play/game-1',
  category: 'literacy' as const,
  difficulty_level: 2,
  target_age_min: 6,
  target_age_max: 8,
  estimated_duration: 10,
  learning_objectives: null,
  is_published: true,
  created_at: '2026-05-18T00:00:00.000Z',
  updated_at: '2026-05-18T00:00:00.000Z',
};


describe('TeacherGamesPageContent', () => {
  function renderPage(games: Parameters<typeof TeacherGamesPageContent>[0]['games']) {
    return render(
      <MantineProvider>
        <TeacherGamesPageContent games={games} />
      </MantineProvider>,
    );
  }

  it('surfaces a clear create activity entry point for teachers', () => {
    renderPage([]);

    expect(
      screen.getByRole('link', { name: /creează activitate/i }),
    ).toHaveAttribute('href', '/teacher/activities/create');
  });

  it('renders the Explore Libraries flow in Romanian', () => {
    renderPage([game]);

    expect(screen.getByRole('heading', { name: 'Activități' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Explorează biblioteca EduPlay' })).toBeInTheDocument();
    expect(screen.getByText('Bibliotecă Seesaw')).toBeInTheDocument();
    expect(screen.getByText('Bibliotecă comunitate')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /caută activități/i })).toHaveAttribute(
      'placeholder',
      'Ce vrei să predai?',
    );
    expect(screen.getByRole('button', { name: 'Selectează nivelul' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Limbă' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Răsfoiește după standarde și curriculum' }),
    ).toBeDisabled();
    const categoryGroup = screen.getByRole('group', { name: /categorii/i });
    expect(
      within(categoryGroup).getByRole('button', { name: /toate materiile/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(categoryGroup).getByRole('button', { name: /^litere$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bibliotecă comunitate' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Colecții recomandate' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Litere magice' })).toBeInTheDocument();
  });

  it('keeps library discovery controls on Mantine-backed primitives', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/games/components/TeacherGamesPageContent.tsx'),
      'utf8',
    );

    expect(source).toContain('TextInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).not.toMatch(/<input\b/);
    expect(source).not.toContain('aria-current');
  });
});
