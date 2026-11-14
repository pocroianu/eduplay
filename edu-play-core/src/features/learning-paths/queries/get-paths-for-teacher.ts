import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LearningPath } from '../types';
import {
  LEARNING_PATH_SELECT,
  mapLearningPathRow,
  type LearningPathRowSnake,
} from './types';

const teacherIdSchema = z.string().uuid();

/**
 * Lists every learning path the calling teacher can act on:
 *
 *   - Paths they own outright (`created_by = teacherId`), regardless of
 *     status — they manage the lifecycle, drafts included.
 *   - Admin-published paths (`owner_kind = 'admin' AND status = 'published'`)
 *     so the curated library shows up in the path picker.
 *
 * RLS handles cross-teacher isolation; this query mirrors the same
 * predicates explicitly so the SQL reads what it intends to do and stays
 * defense-in-depth correct if RLS tightens or loosens later
 * (CTO review of PR #144, EDU-309).
 *
 * Returns `[]` when the supplied id is malformed — callers can render an
 * empty list rather than blow up on a stray query string.
 */
export async function getPathsForTeacher(
  supabase: SupabaseClient,
  teacherId: string,
): Promise<LearningPath[]> {
  const parsed = teacherIdSchema.safeParse(teacherId);
  if (!parsed.success) return [];

  const { data, error } = await supabase
    .from('learning_paths')
    .select(LEARNING_PATH_SELECT)
    .or(
      `created_by.eq.${parsed.data},and(owner_kind.eq.admin,status.eq.published)`,
    )
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`getPathsForTeacher failed: ${error.message}`);
  }

  return ((data ?? []) as LearningPathRowSnake[]).map(mapLearningPathRow);
}
