import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CHILD_ARTIFACTS_BUCKET } from '@/shared/lib/storage/artifact-signed-url';
import type { EnrichedFeedItem, FeedItem } from '../types';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 5;

/**
 * Decorate a feed page with short-lived signed URLs for artifact rows so the
 * client component can render `<Image>`, `<audio>`, or `<video>` without a
 * separate per-item round trip.
 *
 * The underlying portfolio query already enforces RLS (only `family_visible`
 * artifacts for children linked to the caller), so we sign the storage path
 * directly instead of re-fetching the row through `resolveArtifactSignedUrl`.
 * `game_completed` items pass through untouched.
 */
export async function enrichFeedItemsWithSignedUrls(
  supabase: SupabaseClient,
  items: readonly FeedItem[],
  expiresInSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<EnrichedFeedItem[]> {
  return Promise.all(
    items.map(async (item): Promise<EnrichedFeedItem> => {
      if (item.kind === 'game_completed') {
        return { kind: 'game_completed', item };
      }
      const { data, error } = await supabase.storage
        .from(CHILD_ARTIFACTS_BUCKET)
        .createSignedUrl(item.storagePath, expiresInSeconds);
      if (error || !data?.signedUrl) {
        return { kind: 'artifact_published', item, mediaUrl: null };
      }
      return { kind: 'artifact_published', item, mediaUrl: data.signedUrl };
    }),
  );
}
