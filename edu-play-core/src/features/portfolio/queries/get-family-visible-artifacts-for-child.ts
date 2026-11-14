import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Artifact } from '../types';
import { ARTIFACT_SELECT, mapArtifactRow, type ArtifactRow } from './types';

export interface GetFamilyVisibleArtifactsOptions {
  /** Maximum rows to return. Defaults to 50. */
  limit?: number;
}

/**
 * Returns the family-visible artifacts for a single student, ordered by
 * most-recently reviewed. RLS for parents only releases rows where the
 * caller is linked to the student AND the artifact is `family_visible` —
 * we still scope explicitly here so teacher/admin callers get the same
 * filter, and so SQL plans hit `idx_child_artifacts_student_id`.
 *
 * The secondary `id` ordering gives a stable tie-break when multiple
 * artifacts share a `reviewed_at` millisecond — required so Phase 1E
 * cursor-based polling can't permanently skip a row at a `limit` boundary.
 */
export async function getFamilyVisibleArtifactsForChild(
  supabase: SupabaseClient,
  studentId: string,
  options: GetFamilyVisibleArtifactsOptions = {},
): Promise<Artifact[]> {
  const limit = options.limit ?? 50;

  const query = supabase
    .from('child_artifacts')
    .select(ARTIFACT_SELECT)
    .eq('student_id', studentId)
    .eq('visibility', 'family_visible')
    .order('reviewed_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `getFamilyVisibleArtifactsForChild failed: ${error.message}`,
    );
  }

  return ((data ?? []) as ArtifactRow[]).map(mapArtifactRow);
}
