import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeCursor, encodeCursor } from '@/lib/api/cursor';
import type { Artifact } from '../types';
import { ARTIFACT_SELECT, mapArtifactRow, type ArtifactRow } from './types';

export interface GetDraftArtifactsOptions {
  /**
   * Optional class filter. When omitted, returns drafts across every class
   * the teacher owns (subject to RLS).
   */
  classId?: string;
  /** Optional student filter for the teacher review queue. */
  studentId?: string;
  /**
   * Optional lower bound on `created_at` (inclusive, ISO 8601). Used by the
   * teacher review queue date-range filter.
   */
  createdAfter?: string;
  /** Optional upper bound on `created_at` (inclusive, ISO 8601). */
  createdBefore?: string;
  /** Optional limit for paginated views. Defaults to 50. */
  limit?: number;
  /** Opaque keyset cursor returned by the previous page. */
  cursor?: string | null;
}

export interface DraftArtifactsPage {
  items: Artifact[];
  nextCursor: string | null;
}

/**
 * Returns draft artifacts queued for teacher review. Approved
 * (`internal_teacher_only`) and returned (`archived`) responses leave this
 * inbox. RLS scopes the result set to the teacher's classes — we add an
 * explicit `class_id IN (...)` filter when the caller passes a single class
 * to keep the query plan tight.
 *
 * Shape per row is the camel-cased `Artifact` so callers do not see DB
 * snake_case.
 */
export async function getDraftArtifactsForTeacher(
  supabase: SupabaseClient,
  options: GetDraftArtifactsOptions = {},
): Promise<DraftArtifactsPage> {
  const limit = options.limit ?? 50;
  const fetchLimit = limit + 1;

  let query = supabase
    .from('child_artifacts')
    .select(ARTIFACT_SELECT)
    .eq('visibility', 'draft')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit);

  if (options.classId) {
    query = query.eq('class_id', options.classId);
  }
  if (options.studentId) {
    query = query.eq('student_id', options.studentId);
  }
  if (options.createdAfter) {
    query = query.gte('created_at', options.createdAfter);
  }
  if (options.createdBefore) {
    query = query.lte('created_at', options.createdBefore);
  }
  if (options.cursor) {
    const decoded = decodeCursor(options.cursor);
    if (!decoded) {
      throw new Error('getDraftArtifactsForTeacher failed: invalid cursor');
    }
    query = query.or(
      `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`getDraftArtifactsForTeacher failed: ${error.message}`);
  }

  const rows = (data ?? []) as ArtifactRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.created_at, id: last.id })
      : null;

  return {
    items: pageRows.map(mapArtifactRow),
    nextCursor,
  };
}
