import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityFeed, type FeedItem } from './activity-feed';

const inProgressActivity: FeedItem = {
  kind: 'activity_progress',
  id: 'activity-1',
  studentName: 'Ana',
  studentAvatar: null,
  gameTitle: 'Jocul numerelor',
  timestamp: '2026-05-28T09:30:00.000Z',
  score: null,
  status: 'in_progress',
};

describe('ActivityFeed', () => {
  it('uses Romanian diacritics for progress copy and status labels', () => {
    render(
      <MantineProvider>
        <ActivityFeed activities={[inProgressActivity]} />
      </MantineProvider>,
    );

    expect(screen.getByText('Ana joacă "Jocul numerelor"')).toBeInTheDocument();
    expect(screen.getByText('În progres')).toBeInTheDocument();
  });

  it('uses Romanian diacritics in the empty state', () => {
    render(
      <MantineProvider>
        <ActivityFeed activities={[]} />
      </MantineProvider>,
    );

    expect(screen.getByText('Nicio activitate recentă')).toBeInTheDocument();
    expect(
      screen.getByText('Activitățile copiilor vor apărea aici pe măsură ce joacă'),
    ).toBeInTheDocument();
  });

  it('keeps the overflow action on a Mantine Button', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/parent-portal/components/activity-feed.tsx'),
      'utf8',
    );

    expect(source).not.toMatch(/<button\b/);
    expect(source).toContain('<Button');
  });
});
