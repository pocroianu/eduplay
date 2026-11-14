import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getFamilyVisibleArtifactsForChildren } from '@/features/portfolio/server';
import { getLinkedChildren } from '@/features/parent-portal/server';
import type { Artifact } from '@/features/portfolio';
import type {
  ArtifactPublishedFeedItem,
  FeedItem,
  GameCompletedFeedItem,
} from '../types';
import {
  decodeFeedCursor,
  encodeFeedCursor,
  formatArtifactFeedId,
  formatMilestoneFeedId,
  translateForArtifactSide,
  translateForMilestoneSide,
} from './cursor';
import {
  getRecentMilestonesForChildren,
  type MilestoneRow,
} from './get-recent-milestones-for-children';
import type { GetFamilyFeedOptions, GetFamilyFeedResult } from './types';

const DEFAULT_LIMIT = 20;

interface ChildLookup {
  name: string;
  avatarUrl: string | null;
}

/**
 * Family feed for the parent portal. Returns one chronological page across
 * every child the caller is linked to (or just the requested child via
 * `opts.childId`).
 *
 * Composition:
 *   1. Resolve linked children. Empty set short-circuits to an empty page.
 *   2. If `opts.childId` is supplied, validate it belongs to this parent.
 *      Unknown ids return an empty page rather than leaking other parents'
 *      feeds (defense in depth on top of RLS).
 *   3. Decode the opaque `opts.cursor` (base64url over `(ts, feedItemId)`)
 *      and translate it into per-side keyset cursors. Garbled or stale
 *      cursors fall through to "no cursor" rather than 500ing the page.
 *   4. Fetch published artifacts and game-completion milestones in parallel.
 *      Both helpers use `.in('student_id', ids)` so we never N+1 over kids.
 *   5. Merge into a discriminated `FeedItem[]`, sort by `(timestamp, id)`
 *      DESC, slice to `opts.limit ?? 20`.
 *   6. Over-fetch by one row per source — if the merged result still has a
 *      tail past the page, encode the LAST SHOWN item as the next anchor
 *      and use a strict-less-than composite filter on the next request.
 *      Encoding the last shown (instead of the next-after-page item) keeps
 *      the per-side filter strictly `<`, which avoids both the legacy
 *      "boundary item silently dropped" pathology and the same-ts collision
 *      flagged by the EDU-346 deep review.
 */
export async function getFamilyFeed(
  supabase: SupabaseClient,
  parentUserId: string,
  options: GetFamilyFeedOptions = {},
): Promise<GetFamilyFeedResult> {
  const limit = options.limit ?? DEFAULT_LIMIT;

  const linkedChildren = await getLinkedChildren(parentUserId);
  if (linkedChildren.length === 0) {
    return { items: [], nextCursor: null };
  }

  const allowedIds = new Set(linkedChildren.map((c) => c.id));
  let studentIds = linkedChildren.map((c) => c.id);

  if (options.childId) {
    if (!allowedIds.has(options.childId)) {
      return { items: [], nextCursor: null };
    }
    studentIds = [options.childId];
  }

  const childLookup = new Map<string, ChildLookup>(
    linkedChildren.map((c) => [c.id, { name: c.name, avatarUrl: c.avatarUrl }]),
  );

  // Over-fetch by one row per side so we can detect "has more" without a
  // second round-trip. The +1 is per-side rather than total because either
  // source can dominate the page.
  const fetchLimit = limit + 1;
  const decodedCursor = options.cursor
    ? decodeFeedCursor(options.cursor)
    : null;

  const [artifacts, milestones] = await Promise.all([
    getFamilyVisibleArtifactsForChildren(supabase, studentIds, {
      limit: fetchLimit,
      cursor: translateForArtifactSide(decodedCursor),
    }),
    getRecentMilestonesForChildren(supabase, studentIds, {
      limit: fetchLimit,
      cursor: translateForMilestoneSide(decodedCursor),
    }),
  ]);

  const merged: FeedItem[] = [
    ...artifacts.map((a) => mapArtifactToFeedItem(a, childLookup)),
    ...milestones.map((m) => mapMilestoneToFeedItem(m)),
  ].sort(compareFeedItemDesc);

  const items = merged.slice(0, limit);
  const lastShown = items[items.length - 1];
  const hasMore = merged.length > limit;
  const nextCursor =
    hasMore && lastShown
      ? encodeFeedCursor({ ts: lastShown.timestamp, id: lastShown.id })
      : null;
  return { items, nextCursor };
}

function mapArtifactToFeedItem(
  artifact: Artifact,
  childLookup: Map<string, ChildLookup>,
): ArtifactPublishedFeedItem {
  const child = childLookup.get(artifact.studentId);
  return {
    id: formatArtifactFeedId(artifact.id),
    studentId: artifact.studentId,
    studentName: child?.name ?? 'Unknown',
    studentAvatarUrl: child?.avatarUrl ?? null,
    // `family_visible` artifacts always have `reviewed_at`; fall back to
    // `updatedAt` defensively so a malformed row never trips the sort.
    timestamp: artifact.reviewedAt ?? artifact.updatedAt,
    kind: 'artifact_published',
    title: artifact.title,
    artifactType: artifact.artifactType,
    storagePath: artifact.storagePath,
  };
}

function mapMilestoneToFeedItem(row: MilestoneRow): GameCompletedFeedItem {
  return {
    id: formatMilestoneFeedId(row.studentId, row.gameId),
    studentId: row.studentId,
    studentName: row.studentName,
    studentAvatarUrl: row.studentAvatarUrl,
    timestamp: row.lastPlayedAt,
    kind: 'game_completed',
    gameId: row.gameId,
    gameTitle: row.gameTitle,
    score: row.score,
  };
}

/**
 * Stable DESC ordering for the merged feed: timestamp first, then
 * `FeedItem.id` as a lex tie-break. Keeping the secondary key here in
 * sync with the per-side ORDER BY (`id` for artifacts, `(student_id,
 * game_id)` for milestones) is what makes composite cursor pagination
 * collision-safe.
 */
function compareFeedItemDesc(a: FeedItem, b: FeedItem): number {
  if (a.timestamp !== b.timestamp) {
    return a.timestamp < b.timestamp ? 1 : -1;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}
