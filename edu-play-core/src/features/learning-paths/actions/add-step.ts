'use server';

import type { Json } from '@/shared/types/database';
import { revalidatePath } from 'next/cache';
import { ROUTES } from '@/shared/lib/constants';
import { addStepInputSchema } from '../schemas';
import type { ActionResult, LearningPathStep } from '../types';
import {
  mapLearningPathStepRow,
  type LearningPathStepRowSnake,
} from '../queries/types';
import { requireTeacher } from './internal/require-teacher';

// Draft validation and append ordering belong to the database transaction.
export async function addStep(
  input: unknown,
): Promise<ActionResult<{ step: LearningPathStep }>> {
  const parsed = addStepInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Date invalide',
    };
  }

  const auth = await requireTeacher();
  if (!auth.ok) return auth.error;

  const { ctx } = auth;

  const { data, error } = await ctx.supabase
    .rpc('append_learning_path_step', {
      p_path_id: parsed.data.pathId,
      p_title: parsed.data.title,
      p_activity_type: parsed.data.targetActivityType,
      p_config: (parsed.data.targetActivityConfig ?? {}) as Json,
      p_description: parsed.data.description ?? undefined,
    })
    .single();

  if (error || !data) {
    const messages: Record<string, string> = {
      learning_path_not_found: 'Parcursul nu există',
      learning_path_not_draft: 'Nu poți adăuga pași la un parcurs publicat sau arhivat',
      activity_type_not_found: 'Tipul de activitate ales nu există',
    };
    return {
      success: false,
      error: messages[error?.message ?? ''] ?? 'Nu am putut adăuga pasul. Încearcă din nou.',
    };
  }

  revalidatePath(ROUTES.TEACHER.DASHBOARD);

  return {
    success: true,
    data: {
      step: mapLearningPathStepRow(data as LearningPathStepRowSnake),
    },
  };
}
