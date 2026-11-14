import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { camelCaseKeys, parseRows } from '@/lib/api';
import type { Artifact } from '../types';
import { artifactRowSchema } from '../schemas';
import { ARTIFACT_SELECT } from './types';

/**
 * Per-side keyset cursor. See
 * `@/features/family-feed/queries/cursor#ArtifactSideCursor` for the
 * derivation; the modes mirror the three cases the merged feed produces:
 *
 *   - `lt-ts`: strict `reviewed_at < ts` (anchor is on the milestone side
 *     and so all artifacts at the same ts are unreachable, OR the caller
 *     wants legacy "skip the boundary ts" semantics).
 *   - `le-ts`: `reviewed_at <= ts`. Used when the merge-side anchor is a
 *     milestone, since `formatArtifactFeedId` lex-precedes
 *     `formatMilestoneFeedId` at any shared timestamp.
 *   - `lt-or-id-at-ts`: `(reviewed_at, id) < (ts, idAtTs)` lex DESC. Used
 *     when the anchor is itself an artifact.
 */
export type ArtifactCursor =
  | { mode: 'lt-ts'; ts: string }
  | { mode: 'le-ts'; ts: string }
  | { mode: 'lt-or-id-at-ts'; ts: string; idAtTs: string };

export interface GetFamilyVisibleArtifactsForChildrenOptions {
  /** Maximum rows to return across all students. Defaults to 50. */
  limit?: number;
  /**
   * Composite keyset cursor — see {@link ArtifactCursor}. Pass `null`
   * (or omit) for the first page.
   */
  cursor?: ArtifactCursor | null;
}

/**
 * Multi-student variant of `getFamilyVisibleArtifactsForChild`. Used by
 * cross-child views (the parent family feed in particular) so we never
 * loop a per-child query — `.in('student_id', studentIds)` keeps the round
 * trips down to one and the plan hits `idx_child_artifacts_student_id`.
 *
 * Returns the union of family-visible artifacts for the supplied students,
 * ordered by most-recently reviewed with `id` as a stable tie-break. The
 * tie-break aligns with `formatArtifactFeedId` ("artifact:<uuid>") so the
 * per-side fetch and the merged-feed sort agree at the page boundary —
 * required for the composite keyset cursor to be correct under same-ts
 * collisions (EDU-346).
 *
 * Validation: rows pass through `parseRows(camelCaseKeys, artifactRowSchema)`
 * per the EDU-34 boundary-validation pattern, so a drift between the live
 * `child_artifacts` schema and the `Artifact` type fails loud at this seam
 * instead of silently flowing into UI consumers.
 *
 * RLS is still the authority on which rows are released — passing a student
 * the caller is not linked to simply yields no rows for them.
 */
export async function getFamilyVisibleArtifactsForChildren(
  supabase: SupabaseClient,
  studentIds: readonly string[],
  options: GetFamilyVisibleArtifactsForChildrenOptions = {},
): Promise<Artifact[]> {
  if (studentIds.length === 0) {
    return [];
  }

  const limit = options.limit ?? 50;

  let query = supabase
    .from('child_artifacts')
    .select(ARTIFACT_SELECT)
    .in('student_id', studentIds)
    .eq('visibility', 'family_visible');

  const cursor = options.cursor ?? null;
  if (cursor) {
    if (cursor.mode === 'lt-ts') {
      query = query.lt('reviewed_at', cursor.ts);
    } else if (cursor.mode === 'le-ts') {
      query = query.lte('reviewed_at', cursor.ts);
    } else {
      // `(reviewed_at, id) < (ts, idAtTs)` lex DESC — Postgres tuple
      // compare via PostgREST or() chain (mirrors `/api/v1/admin/audit`).
      query = query.or(
        `reviewed_at.lt.${cursor.ts},and(reviewed_at.eq.${cursor.ts},id.lt.${cursor.idAtTs})`,
      );
    }
  }

  const { data, error } = await query
    .order('reviewed_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `getFamilyVisibleArtifactsForChildren failed: ${error.message}`,
    );
  }

  const camelRows = (data ?? []).map((row) => camelCaseKeys(row));
  return parseRows(
    camelRows,
    artifactRowSchema,
    'getFamilyVisibleArtifactsForChildren',
  );
}
