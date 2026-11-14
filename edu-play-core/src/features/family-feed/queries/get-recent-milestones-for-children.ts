import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { camelCaseKeys, parseRows } from '@/lib/api';

/**
 * Internal row shape returned to `getFamilyFeed`. snake_case is mapped to
 * camelCase before validation so the Zod schema doubles as the contract that
 * downstream merge logic depends on.
 */
export interface MilestoneRow {
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  gameId: string;
  gameTitle: string;
  /** Non-null by construction — query filters out rows missing it. */
  lastPlayedAt: string;
  score: number | null;
}

const studentJoinSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

const activityJoinSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
});

/**
 * Schema for an `activity_progress` row joined with `students` + `activities`. Matches
 * the camelCase entity (i.e., post-`camelCaseKeys`) per EDU-34's parseRow
 * convention. Permissive on dimensions that have no DB CHECK — `score` is
 * just int-or-null, not bounded.
 */
const milestoneRowSchema = z.object({
  studentId: z.string().uuid(),
  activityId: z.string().uuid(),
  score: z.number().int().nullable(),
  lastPlayedAt: z.string(),
  students: studentJoinSchema.nullable(),
  activities: activityJoinSchema.nullable(),
});

const SELECT = `
  student_id,
  activity_id,
  score,
  last_played_at,
  students (
    id,
    username,
    avatar_url
  ),
  activities:activity_id (
    id,
    title
  )
`;

/**
 * Per-side keyset cursor. See
 * `@/features/family-feed/queries/cursor#MilestoneSideCursor` for the
 * derivation:
 *
 *   - `lt-ts`: strict `last_played_at < ts`. Used when the merge-side
 *     anchor is an artifact, since `formatMilestoneFeedId`
 *     ("milestone:...") lex-exceeds `formatArtifactFeedId`
 *     ("artifact:...") at any shared timestamp — every milestone at `ts`
 *     would already have appeared on the previous page.
 *   - `lt-or-id-at-ts`: anchor is itself a milestone at `ts`, with
 *     composite tie-break id `(studentIdAtTs, gameIdAtTs)`. During the
 *     Activity Progress migration, `gameIdAtTs` is compared against the
 *     Activity identity used in milestone feed IDs.
 */
export type MilestoneCursor =
  | { mode: 'lt-ts'; ts: string }
  | {
      mode: 'lt-or-id-at-ts';
      ts: string;
      studentIdAtTs: string;
      gameIdAtTs: string;
    };

export interface GetRecentMilestonesForChildrenOptions {
  /** Maximum rows to return across all students. Defaults to 50. */
  limit?: number;
  /**
   * Composite keyset cursor — see {@link MilestoneCursor}. Pass `null`
   * (or omit) for the first page.
   */
  cursor?: MilestoneCursor | null;
}

/**
 * Multi-student fetch of recent completed-Activity milestones for the family
 * feed. Mirrors `parent-portal/queries/get-recent-activity.ts` in shape but
 * with `.in('student_id', studentIds)` so the cross-child feed is one round
 * trip, not N+1.
 *
 * Filters:
 *   - `status = 'completed'` — only finished Activities surface as a milestone.
 *   - `last_played_at IS NOT NULL` — defensive; the feed's timestamp pivot
 *     can't be null.
 *
 * Ordering: `last_played_at DESC, student_id DESC, activity_id DESC`. The
 * `(student_id, activity_id)` tie-break aligns with the merged feed's
 * `formatMilestoneFeedId` sort, so the per-side over-fetch and the merge
 * agree at the same-timestamp boundary — required for the composite
 * keyset cursor to surface every collision-bound row exactly once
 * (EDU-346).
 *
 * Validation: each row passes through `parseRows(camelCaseKeys, …)` so a
 * drift between the live `activity_progress` schema and the generated types
 * surfaces as a structured server log + thrown error rather than a silent
 * shape mismatch in the feed UI.
 */
export async function getRecentMilestonesForChildren(
  supabase: SupabaseClient,
  studentIds: readonly string[],
  options: GetRecentMilestonesForChildrenOptions = {},
): Promise<MilestoneRow[]> {
  if (studentIds.length === 0) {
    return [];
  }

  const limit = options.limit ?? 50;

  let query = supabase
    .from('activity_progress')
    .select(SELECT)
    .in('student_id', studentIds)
    .eq('status', 'completed')
    .not('last_played_at', 'is', null);

  const cursor = options.cursor ?? null;
  if (cursor) {
    if (cursor.mode === 'lt-ts') {
      query = query.lt('last_played_at', cursor.ts);
    } else {
      // `(last_played_at, student_id, activity_id) < (ts, S, A)` lex DESC.
      // PostgREST has no native tuple compare, so the lex condition is
      // expressed as three OR branches:
      //   ts < TS
      //   OR (ts = TS AND student_id < S)
      //   OR (ts = TS AND student_id = S AND game_id < G)
      query = query.or(
        [
          `last_played_at.lt.${cursor.ts}`,
          `and(last_played_at.eq.${cursor.ts},student_id.lt.${cursor.studentIdAtTs})`,
          `and(last_played_at.eq.${cursor.ts},student_id.eq.${cursor.studentIdAtTs},activity_id.lt.${cursor.gameIdAtTs})`,
        ].join(','),
      );
    }
  }

  const { data, error } = await query
    .order('last_played_at', { ascending: false, nullsFirst: false })
    .order('student_id', { ascending: false })
    .order('activity_id', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`getRecentMilestonesForChildren failed: ${error.message}`);
  }

  const camelRows = (data ?? []).map((row) => camelCaseKeys(row));
  const parsed = parseRows(
    camelRows,
    milestoneRowSchema,
    'getRecentMilestonesForChildren',
  );

  return parsed.map((row) => ({
    studentId: row.studentId,
    studentName: row.students?.username ?? 'Unknown',
    studentAvatarUrl: row.students?.avatarUrl ?? null,
    gameId: row.activityId,
    gameTitle: row.activities?.title ?? 'Unknown Activity',
    lastPlayedAt: row.lastPlayedAt,
    score: row.score,
  }));
}
