'use server';

import { revalidatePath } from 'next/cache';
import { ROUTES } from '@/shared/lib/constants';
import { createPathInputSchema } from '../schemas';
import type { ActionResult, LearningPath } from '../types';
import {
  LEARNING_PATH_SELECT,
  mapLearningPathRow,
  type LearningPathRowSnake,
} from '../queries/types';
import { requireTeacher } from './internal/require-teacher';

/**
 * Creates a new learning path owned by the calling teacher (or admin).
 *
 * The path always lands in `draft`; `publishPath` flips it to `published`
 * after the teacher is happy with it. RLS enforces ownership on both
 * insert and the subsequent select.
 */
export async function createPath(
  input: unknown,
): Promise<ActionResult<{ path: LearningPath }>> {
  const parsed = createPathInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Date invalide',
    };
  }

  const auth = await requireTeacher();
  if (!auth.ok) return auth.error;

  const { ctx } = auth;
  const ownerKind = ctx.profile.role === 'admin' ? 'admin' : 'teacher';

  const { data, error } = await ctx.supabase
    .from('learning_paths')
    .insert({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      age_min: parsed.data.ageMin ?? null,
      age_max: parsed.data.ageMax ?? null,
      status: 'draft',
      owner_kind: ownerKind,
      created_by: ctx.user.id,
    })
    .select(LEARNING_PATH_SELECT)
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: 'Nu am putut crea parcursul. Încearcă din nou.',
    };
  }

  revalidatePath(ROUTES.TEACHER.DASHBOARD);

  return {
    success: true,
    data: { path: mapLearningPathRow(data as LearningPathRowSnake) },
  };
}
