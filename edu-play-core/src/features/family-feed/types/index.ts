// Family Feed Feature - Shared Types
// Items surface on the parent /parent feed. Each item is a discriminated
// union over `kind` so callers can switch on shape without type guards.
//
// Source of truth for fields:
//   - artifact_published: derived from `child_artifacts` once visibility flips
//     to `family_visible` (see PRIVACY.md §7.1, portfolio feature).
//   - game_completed: derived from `activity_progress.last_played_at` for the
//     parent's linked children (see EDU-33 plan).

import type { ArtifactType } from '@/features/portfolio';

export interface FeedItemBase {
  id: string;
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  /** ISO-8601 timestamp the item was anchored at (reviewed_at or last_played_at). */
  timestamp: string;
}

export interface ArtifactPublishedFeedItem extends FeedItemBase {
  kind: 'artifact_published';
  title: string | null;
  artifactType: ArtifactType;
  storagePath: string;
}

export interface GameCompletedFeedItem extends FeedItemBase {
  kind: 'game_completed';
  gameId: string;
  gameTitle: string;
  score: number | null;
}

export type FeedItem = ArtifactPublishedFeedItem | GameCompletedFeedItem;

/**
 * Page envelope for cursor-based pagination. `nextCursor` is opaque to the
 * caller — pass it back verbatim on the next request to fetch the next page.
 */
export interface FamilyFeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

/**
 * Feed item enriched with a short-lived signed URL so client renderers can
 * mount `<Image>`, `<audio>`, or `<video>` without a per-item round trip.
 *
 * `mediaUrl` is `null` when signing failed for that artifact (e.g. the
 * underlying object is missing) — renderers should fall back to a placeholder
 * card rather than 500ing the page.
 */
export type EnrichedFeedItem =
  | {
      kind: 'artifact_published';
      item: ArtifactPublishedFeedItem;
      mediaUrl: string | null;
    }
  | {
      kind: 'game_completed';
      item: GameCompletedFeedItem;
    };
