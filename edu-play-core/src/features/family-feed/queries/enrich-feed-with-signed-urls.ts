import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withArtifactMedia } from '@/features/portfolio/server';
import type { EnrichedFeedItem, FeedItem } from '../types';

export async function enrichFeedItemsWithSignedUrls(
  supabase: SupabaseClient,
  items: readonly FeedItem[],
  expiresInSeconds = 60 * 5,
): Promise<EnrichedFeedItem[]> {
  const artifacts = await withArtifactMedia(
    supabase,
    items.filter((item) => item.kind === 'artifact_published'),
    expiresInSeconds,
  );
  const media = new Map(artifacts.map((item) => [item.id, item.mediaUrl]));
  return items.map((item) =>
    item.kind === 'game_completed'
      ? { kind: 'game_completed', item }
      : {
          kind: 'artifact_published',
          item,
          mediaUrl: media.get(item.id) ?? null,
        },
  );
}
