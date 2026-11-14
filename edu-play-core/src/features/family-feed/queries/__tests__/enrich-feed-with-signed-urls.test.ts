import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enrichFeedItemsWithSignedUrls } from '../enrich-feed-with-signed-urls';
import type { FeedItem } from '../../types';

function makeClient(
  signResults: Record<string, { signedUrl?: string; error?: string }>,
): SupabaseClient {
  const createSignedUrl = vi.fn(async (path: string) => {
    const result = signResults[path];
    if (!result) {
      return { data: null, error: { message: 'no-such-path' } };
    }
    if (result.error) {
      return { data: null, error: { message: result.error } };
    }
    return { data: { signedUrl: result.signedUrl }, error: null };
  });
  const fromBucket = vi.fn(() => ({ createSignedUrl }));
  return {
    storage: { from: fromBucket },
  } as unknown as SupabaseClient;
}

const ARTIFACT: FeedItem = {
  kind: 'artifact_published',
  id: 'artifact:art-1',
  studentId: 'stu-1',
  studentName: 'Ana',
  studentAvatarUrl: null,
  title: 'Drawing',
  artifactType: 'drawing',
  storagePath: 'artifacts/stu-1/art-1.png',
  timestamp: '2026-05-01T00:00:00.000Z',
};

const GAME: FeedItem = {
  kind: 'game_completed',
  id: 'milestone:stu-1:game-1',
  studentId: 'stu-1',
  studentName: 'Ana',
  studentAvatarUrl: null,
  gameId: 'game-1',
  gameTitle: 'Listen & Tap',
  score: 80,
  timestamp: '2026-05-01T00:01:00.000Z',
};

describe('enrichFeedItemsWithSignedUrls', () => {
  it('returns an empty list when given no items', async () => {
    const supabase = makeClient({});
    expect(await enrichFeedItemsWithSignedUrls(supabase, [])).toEqual([]);
  });

  it('signs artifact URLs and passes game items through', async () => {
    const supabase = makeClient({
      'artifacts/stu-1/art-1.png': {
        signedUrl: 'https://example.com/signed/art-1.png',
      },
    });
    const result = await enrichFeedItemsWithSignedUrls(supabase, [
      ARTIFACT,
      GAME,
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      kind: 'artifact_published',
      item: ARTIFACT,
      mediaUrl: 'https://example.com/signed/art-1.png',
    });
    expect(result[1]).toEqual({ kind: 'game_completed', item: GAME });
  });

  it('returns null mediaUrl when signing fails so the page still renders', async () => {
    const supabase = makeClient({
      'artifacts/stu-1/art-1.png': { error: 'storage_error' },
    });
    const result = await enrichFeedItemsWithSignedUrls(supabase, [ARTIFACT]);
    expect(result).toEqual([
      { kind: 'artifact_published', item: ARTIFACT, mediaUrl: null },
    ]);
  });
});
