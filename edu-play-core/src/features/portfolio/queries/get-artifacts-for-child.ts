import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { camelCaseKeys, parseRows } from '@/lib/api';
import type { Artifact } from '../types';
import { artifactRowSchema } from '../schemas';
import { ARTIFACT_SELECT, type ArtifactRow } from './types';

export type ChildPortfolioRole = 'teacher' | 'parent' | 'admin';

export interface GetArtifactsForChildOptions {
  childId: string;
  role: ChildPortfolioRole;
  /**
   * Teacher view excludes `archived` rows by default. Set true to include
   * them (e.g. an "Arhivă" toggle in a future PR). Ignored for `parent`
   * (visibility is locked to `family_visible`) and `admin` (no filter).
   */
  includeArchived?: boolean;
  /** Maximum rows to return. Defaults to 50 — single page until pagination ships. */
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const ROLES: readonly ChildPortfolioRole[] = ['teacher', 'parent', 'admin'];

/**
 * Returns the per-child portfolio timeline, ordered most-recent first.
 *
 * Role-aware filtering:
 *  - `parent`: only `visibility = 'family_visible'` rows. RLS already enforces
 *    the parent-child link; we still scope explicitly so the query plan hits
 *    `idx_child_artifacts_student_id` and the result set is identical for
 *    teacher/admin callers asking for the same view.
 *  - `teacher`: every visibility scoped by RLS to the teacher's class students,
 *    excluding `archived` unless `includeArchived` is true.
 *  - `admin`: every visibility, no archived filter.
 *
 * `created_at` orders the timeline (intake order, stable across publishes);
 * the secondary `id` ordering gives a deterministic tie-break when two
 * artifacts share a millisecond.
 */
export async function getArtifactsForChild(
  supabase: SupabaseClient,
  options: GetArtifactsForChildOptions,
): Promise<Artifact[]> {
  if (!ROLES.includes(options.role)) {
    throw new Error(`getArtifactsForChild: unsupported role=${options.role}`);
  }

  const limit = options.limit ?? DEFAULT_LIMIT;

  let query = supabase
    .from('child_artifacts')
    .select(ARTIFACT_SELECT)
    .eq('student_id', options.childId);

  if (options.role === 'parent') {
    query = query.eq('visibility', 'family_visible');
  } else if (options.role === 'teacher' && !options.includeArchived) {
    query = query.not('visibility', 'eq', 'archived');
  }

  query = query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    throw new Error(`getArtifactsForChild failed: ${error.message}`);
  }

  const rows = (data ?? []) as ArtifactRow[];
  return parseRows(
    rows.map((row) => camelCaseKeys(row)),
    artifactRowSchema,
    `getArtifactsForChild(${options.role})`,
  );
}
