import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ParentGamesPageContent } from './ParentGamesPageContent';
import type { Game } from '../types';

const catalogGame: Game = {
  id: 'activity-1',
  title: 'Culori vesele',
  description: 'Potrivește culorile.',
  thumbnail_url: null,
  game_url: '/play/activity-1',
  category: 'colors',
  difficulty_level: 1,
  target_age_min: 4,
  target_age_max: 6,
  estimated_duration: 5,
  learning_objectives: ['culori'],
  is_published: true,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
};

describe('ParentGamesPageContent', () => {
  it('renders playable catalog activities even when the parent has no linked child progress', () => {
    render(
      <MantineProvider>
        <ParentGamesPageContent childProgress={[]} catalogGames={[catalogGame]} />
      </MantineProvider>,
    );

    const playLink = screen.getByRole('link', { name: /joacă/i });

    expect(screen.getByText('Culori vesele')).toBeInTheDocument();
    expect(playLink).toHaveAttribute('href', '/play/activity-1');
    expect(playLink).toHaveClass('mantine-Button-root');
  });
});
