import { decodeCursor, encodeCursor } from '@/lib/api/cursor';

/**
 * Composite keyset cursor for `getFamilyFeed`. The merged feed is sorted
 * `(timestamp DESC, feedItemId DESC)`, so each page's anchor is the
 * `(timestamp, feedItemId)` pair of the last shown item — page N+1 then
 * fetches rows whose `(timestamp_col, side_id)` ranks strictly below the
 * anchor in the same lexicographic ordering.
 *
 * Wire format reuses `@/lib/api/cursor` (`base64url(${ts}|${id})`), so
 * consumers continue to treat `nextCursor` as an opaque string. The "id"
 * half is the `FeedItem.id` (`artifact:<uuid>` or
 * `milestone:<studentId>:<gameId>`), which is enough to recover the side
 * and per-side tie-break id when the next page comes back through.
 *
 * Why the boundary fix matters: the legacy timestamp-only cursor used a
 * strict `.lt()` against the boundary timestamp, which silently dropped
 * any item whose `reviewed_at`/`last_played_at` collided with the anchor
 * (PR #135 deep-review finding). The composite form ensures items at the
 * exact boundary timestamp are still routed to the correct page.
 */
export interface FeedCursorPayload {
  /** Anchor timestamp — `reviewed_at` or `last_played_at` of the last shown item. */
  ts: string;
  /** Anchor `FeedItem.id` — `artifact:<uuid>` or `milestone:<studentId>:<gameId>`. */
  id: string;
}

export function encodeFeedCursor(payload: FeedCursorPayload): string {
  return encodeCursor({ createdAt: payload.ts, id: payload.id });
}

export function decodeFeedCursor(value: string): FeedCursorPayload | null {
  const decoded = decodeCursor(value);
  if (!decoded) return null;
  return { ts: decoded.createdAt, id: decoded.id };
}

const ARTIFACT_PREFIX = 'artifact:';
const MILESTONE_PREFIX = 'milestone:';

// Cursor id halves are interpolated into PostgREST `.or(...)` predicates by
// the per-side feed queries, so anything that isn't a strict UUID must be
// rejected up-front: a tampered base64 cursor whose suffix contains reserved
// filter characters (`,`, `(`, `)`, `:`, `*`, `"`) would otherwise broaden
// or invalidate the filter rather than being treated as "no cursor".
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatArtifactFeedId(artifactId: string): string {
  return `${ARTIFACT_PREFIX}${artifactId}`;
}

export function formatMilestoneFeedId(
  studentId: string,
  gameId: string,
): string {
  return `${MILESTONE_PREFIX}${studentId}:${gameId}`;
}

export type ParsedFeedItemId =
  | { kind: 'artifact'; artifactId: string }
  | { kind: 'milestone'; studentId: string; gameId: string };

/**
 * Parse a `FeedItem.id` produced by `formatArtifactFeedId` /
 * `formatMilestoneFeedId`. Returns `null` for inputs that don't match
 * either prefix shape, and also for prefix-matching inputs whose id
 * halves are not strict UUIDs — callers should treat `null` as a stale
 * or malformed cursor and fall through to "no cursor" semantics, which
 * keeps tampered cursor payloads from reaching the per-side `.or(...)`
 * filters.
 */
export function parseFeedItemId(id: string): ParsedFeedItemId | null {
  if (id.startsWith(ARTIFACT_PREFIX)) {
    const artifactId = id.slice(ARTIFACT_PREFIX.length);
    if (!UUID_RE.test(artifactId)) return null;
    return { kind: 'artifact', artifactId };
  }
  if (id.startsWith(MILESTONE_PREFIX)) {
    const rest = id.slice(MILESTONE_PREFIX.length);
    const sep = rest.indexOf(':');
    if (sep <= 0) return null;
    const studentId = rest.slice(0, sep);
    const gameId = rest.slice(sep + 1);
    if (!UUID_RE.test(studentId) || !UUID_RE.test(gameId)) return null;
    return { kind: 'milestone', studentId, gameId };
  }
  return null;
}

/**
 * Per-side cursor passed to `getFamilyVisibleArtifactsForChildren`. The
 * artifact-feed merge order is "artifact:<uuid>" — lexicographically less
 * than any "milestone:..." at the same timestamp — so the side has three
 * cases:
 *
 *   - `lt-ts`: anchor was an artifact-side ROW that already exhausted its
 *     same-ts neighbours, OR (rarely) the cursor must skip same-ts rows
 *     entirely. Filter: `reviewed_at < ts`.
 *   - `le-ts`: anchor lives on the milestone side. Every artifact at
 *     `reviewed_at = ts` is lex-less-than `milestone:...:...` and so
 *     belongs on this page. Filter: `reviewed_at <= ts`.
 *   - `lt-or-id-at-ts`: anchor is an artifact at `ts` with id `idAtTs`.
 *     Filter: `reviewed_at < ts OR (reviewed_at = ts AND id < idAtTs)`.
 */
export type ArtifactSideCursor =
  | { mode: 'lt-ts'; ts: string }
  | { mode: 'le-ts'; ts: string }
  | { mode: 'lt-or-id-at-ts'; ts: string; idAtTs: string };

/**
 * Per-side cursor passed to `getRecentMilestonesForChildren`. The
 * milestone-feed merge order is "milestone:<studentId>:<gameId>" —
 * lexicographically GREATER than any "artifact:..." at the same
 * timestamp:
 *
 *   - `lt-ts`: anchor lives on the artifact side. No milestone at
 *     `last_played_at = ts` qualifies (every "milestone:..." > anchor).
 *     Filter: `last_played_at < ts`.
 *   - `lt-or-id-at-ts`: anchor is a milestone at `ts` with composite id
 *     `(studentIdAtTs, gameIdAtTs)`. Filter: `last_played_at < ts OR
 *     (last_played_at = ts AND (student_id, game_id) < (studentIdAtTs,
 *     gameIdAtTs))`.
 *
 * Note: the "le-ts" symmetric case (every milestone at `ts` qualifies)
 * is unreachable given the prefix order, so it is intentionally omitted.
 */
export type MilestoneSideCursor =
  | { mode: 'lt-ts'; ts: string }
  | {
      mode: 'lt-or-id-at-ts';
      ts: string;
      studentIdAtTs: string;
      gameIdAtTs: string;
    };

/**
 * Translate the merged-feed cursor into the per-side cursor each helper
 * understands. Unknown anchor shapes fall through to `null` — the caller
 * then treats them as "no cursor" rather than serving an inconsistent
 * page from a half-decoded anchor.
 */
export function translateForArtifactSide(
  cursor: FeedCursorPayload | null,
): ArtifactSideCursor | null {
  if (!cursor) return null;
  const parsed = parseFeedItemId(cursor.id);
  if (!parsed) return null;
  if (parsed.kind === 'artifact') {
    return {
      mode: 'lt-or-id-at-ts',
      ts: cursor.ts,
      idAtTs: parsed.artifactId,
    };
  }
  // anchor is a milestone — every artifact at the same ts lex-precedes it.
  return { mode: 'le-ts', ts: cursor.ts };
}

export function translateForMilestoneSide(
  cursor: FeedCursorPayload | null,
): MilestoneSideCursor | null {
  if (!cursor) return null;
  const parsed = parseFeedItemId(cursor.id);
  if (!parsed) return null;
  if (parsed.kind === 'milestone') {
    return {
      mode: 'lt-or-id-at-ts',
      ts: cursor.ts,
      studentIdAtTs: parsed.studentId,
      gameIdAtTs: parsed.gameId,
    };
  }
  // anchor is an artifact — no milestone at the same ts can precede it.
  return { mode: 'lt-ts', ts: cursor.ts };
}
