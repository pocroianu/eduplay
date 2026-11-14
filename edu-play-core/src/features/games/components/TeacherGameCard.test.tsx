import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import { TeacherGameCard } from './TeacherGameCard';
import type { Game } from '../types';

const game: Game = {
  id: 'activity-1',
  title: 'Fracții rapide',
  description: 'Exersează fracțiile prin joc.',
  thumbnail_url: null,
  game_url: '/play/activity-1',
  category: 'math',
  difficulty_level: 3,
  target_age_min: 7,
  target_age_max: 9,
  estimated_duration: 8,
  learning_objectives: ['fracții'],
  is_published: true,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
};

describe('TeacherGameCard', () => {
  it('lets teachers preview catalog activities and assign them', () => {
    const onAssign = vi.fn();

    render(
      <MantineProvider>
        <TeacherGameCard game={game} onAssign={onAssign} />
      </MantineProvider>,
    );

    expect(screen.getByRole('link', { name: /previzualizează activitatea fracții rapide/i })).toHaveAttribute(
      'href',
      '/play/activity-1',
    );

    fireEvent.click(screen.getByRole('button', { name: /atribuie activitatea fracții rapide/i }));
    expect(onAssign).toHaveBeenCalledWith('activity-1');
  });
});
