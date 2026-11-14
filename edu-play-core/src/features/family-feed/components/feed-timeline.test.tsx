import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { FeedTimeline } from './feed-timeline';
import type { EnrichedFeedItem } from '../types';

const ARTIFACT_PHOTO: EnrichedFeedItem = {
  kind: 'artifact_published',
  mediaUrl: 'https://example.com/signed/photo.jpg',
  item: {
    kind: 'artifact_published',
    id: 'artifact:art-1',
    studentId: 'stu-1',
    studentName: 'Ana Popescu',
    studentAvatarUrl: null,
    title: 'Plimbare în parc',
    artifactType: 'photo',
    storagePath: 'artifacts/stu-1/art-1.jpg',
    timestamp: '2026-05-01T00:00:00.000Z',
  },
};

const ARTIFACT_AUDIO: EnrichedFeedItem = {
  kind: 'artifact_published',
  mediaUrl: 'https://example.com/signed/voice.mp3',
  item: {
    kind: 'artifact_published',
    id: 'artifact:art-2',
    studentId: 'stu-1',
    studentName: 'Ana Popescu',
    studentAvatarUrl: null,
    title: 'Poveste de seară',
    artifactType: 'audio',
    storagePath: 'artifacts/stu-1/art-2.mp3',
    timestamp: '2026-05-01T00:01:00.000Z',
  },
};

const ARTIFACT_VIDEO: EnrichedFeedItem = {
  kind: 'artifact_published',
  mediaUrl: 'https://example.com/signed/clip.mp4',
  item: {
    kind: 'artifact_published',
    id: 'artifact:art-3',
    studentId: 'stu-1',
    studentName: 'Ana Popescu',
    studentAvatarUrl: null,
    title: null,
    artifactType: 'video',
    storagePath: 'artifacts/stu-1/art-3.mp4',
    timestamp: '2026-05-01T00:02:00.000Z',
  },
};

const ARTIFACT_MISSING_URL: EnrichedFeedItem = {
  kind: 'artifact_published',
  mediaUrl: null,
  item: {
    kind: 'artifact_published',
    id: 'artifact:art-4',
    studentId: 'stu-1',
    studentName: 'Ana Popescu',
    studentAvatarUrl: null,
    title: 'Lucrare',
    artifactType: 'photo',
    storagePath: 'artifacts/stu-1/art-4.png',
    timestamp: '2026-05-01T00:03:00.000Z',
  },
};

const GAME: EnrichedFeedItem = {
  kind: 'game_completed',
  item: {
    kind: 'game_completed',
    id: 'milestone:stu-1:game-1',
    studentId: 'stu-1',
    studentName: 'Ana Popescu',
    studentAvatarUrl: null,
    gameId: 'game-1',
    gameTitle: 'Listen & Tap',
    score: 80,
    timestamp: '2026-05-01T00:04:00.000Z',
  },
};

const resources = {
  en: {
    parent: {
      feed: {
        badgeArtifact: 'New Work',
        badgeGame: 'Game Completed',
        unavailablePhoto: 'Work is not available right now.',
        unavailableAudio: 'Recording is not available right now.',
        unavailableVideo: 'Video is not available right now.',
        gameSubtitle: 'Finished a new game',
        defaultPhotoTitle: 'New Photo',
        defaultDrawingTitle: 'New Drawing',
        defaultAudioTitle: 'New Recording',
        defaultVideoTitle: 'New Video',
        defaultArtifactTitle: 'New Work',
      },
    },
  },
} as const;

describe('FeedTimeline', () => {
  it('returns null when there are no items', () => {
    const { container } = render(<FeedTimeline items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders each item kind with the correct data-feed-kind attribute', () => {
    render(
      <I18nProvider lang="en" resources={resources}>
        <FeedTimeline
          items={[ARTIFACT_PHOTO, ARTIFACT_AUDIO, ARTIFACT_VIDEO, GAME]}
        />
      </I18nProvider>,
    );
    const list = screen.getByTestId('family-feed-timeline');
    const items = list.querySelectorAll('li');
    expect(items).toHaveLength(4);
    expect(items[0]?.getAttribute('data-feed-kind')).toBe('artifact_published');
    expect(items[3]?.getAttribute('data-feed-kind')).toBe('game_completed');
  });

  it('exposes each item timestamp for E2E order assertions', () => {
    render(
      <I18nProvider lang="en" resources={resources}>
        <FeedTimeline items={[ARTIFACT_PHOTO, GAME]} />
      </I18nProvider>,
    );
    const list = screen.getByTestId('family-feed-timeline');
    const items = list.querySelectorAll('li');

    expect(items[0]?.getAttribute('data-feed-timestamp')).toBe(
      ARTIFACT_PHOTO.item.timestamp,
    );
    expect(items[1]?.getAttribute('data-feed-timestamp')).toBe(
      GAME.item.timestamp,
    );
  });

  it('renders an Image for photo / drawing artifacts using the signed URL', () => {
    render(
      <I18nProvider lang="en" resources={resources}>
        <FeedTimeline items={[ARTIFACT_PHOTO]} />
      </I18nProvider>,
    );
    const img = screen.getByRole('img', { name: /plimbare în parc/i });
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toContain('photo.jpg');
  });

  it('renders an audio control for audio artifacts', () => {
    render(
      <I18nProvider lang="en" resources={resources}>
        <FeedTimeline items={[ARTIFACT_AUDIO]} />
      </I18nProvider>,
    );
    const audio = document.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute('src')).toBe(
      'https://example.com/signed/voice.mp3',
    );
    expect(audio?.hasAttribute('controls')).toBe(true);
  });

  it('renders a video control for video artifacts and falls back to a default title', () => {
    render(
      <I18nProvider lang="en" resources={resources}>
        <FeedTimeline items={[ARTIFACT_VIDEO]} />
      </I18nProvider>,
    );
    const video = document.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe(
      'https://example.com/signed/clip.mp4',
    );
    expect(screen.getByText('New Video')).toBeInTheDocument();
  });

  it('renders a friendly placeholder when the signed URL is unavailable', () => {
    render(
      <I18nProvider lang="en" resources={resources}>
        <FeedTimeline items={[ARTIFACT_MISSING_URL]} />
      </I18nProvider>,
    );
    expect(
      screen.getByText(/work is not available right now/i),
    ).toBeInTheDocument();
  });

  it('renders the game title and score chip for game_completed items', () => {
    render(
      <I18nProvider lang="en" resources={resources}>
        <FeedTimeline items={[GAME]} />
      </I18nProvider>,
    );
    expect(screen.getByText('Listen & Tap')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Game Completed')).toBeInTheDocument();
    expect(screen.getByText('Finished a new game')).toBeInTheDocument();
  });

  it('shows the relative-time stamp and student name in each header', () => {
    render(
      <I18nProvider lang="en" resources={resources}>
        <FeedTimeline items={[ARTIFACT_PHOTO]} />
      </I18nProvider>,
    );
    const list = screen.getByTestId('family-feed-timeline');
    expect(within(list).getByText('Ana Popescu')).toBeInTheDocument();
    expect(list.querySelector('time')).toHaveAttribute(
      'dateTime',
      ARTIFACT_PHOTO.item.timestamp,
    );
  });
});
