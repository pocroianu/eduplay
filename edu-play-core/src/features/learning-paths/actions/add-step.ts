'use server';

import { revalidatePath } from 'next/cache';
import { ROUTES } from '@/shared/lib/constants';
import { addStepInputSchema } from '../schemas';
import type { ActionResult, LearningPathStep } from '../types';
import {
  LEARNING_PATH_STEP_SELECT,
  mapLearningPathStepRow,
  type LearningPathStepRowSnake,
} from '../queries/types';
import { requireTeacher } from './internal/require-teacher';

/**
 * Appends an Activity-template step to an existing path. Legacy game-targeted
 * steps were removed by the Activity-only cutover.
 *
 * Step ordering is the caller's responsibility — the path-builder UI
 * (EDU-31.C) computes the next `step_order` from the current list. This
 * action does not auto-shift sibling rows.
 *
 * Published / archived paths are immutable: students may have in-flight
 * `student_path_progress.completed` rows whose meaning depends on a
 * frozen step list. Mutating a published path turns "completed" into a
 * lie. RLS doesn't enforce this — it lets the owner write any step row
 * for any of their paths regardless of `learning_paths.status` — so we
 * gate it here (CTO follow-up triage of PR #144, EDU-309).
 */
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

  const { data: pathRow, error: pathError } = await ctx.supabase
    .from('learning_paths')
    .select('status')
    .eq('id', parsed.data.pathId)
    .maybeSingle();

  if (pathError) {
    return {
      success: false,
      error: 'Nu am putut adăuga pasul. Încearcă din nou.',
    };
  }

  if (!pathRow) {
    return { success: false, error: 'Parcursul nu există' };
  }

  if (pathRow.status !== 'draft') {
    return {
      success: false,
      error: 'Nu poți adăuga pași la un parcurs publicat sau arhivat',
    };
  }

  const { data: activityTypeRow, error: activityTypeError } = await ctx.supabase
    .from('activity_types')
    .select('type_id')
    .eq('type_id', parsed.data.targetActivityType)
    .maybeSingle();

  if (activityTypeError) {
    return {
      success: false,
      error: 'Nu am putut adăuga pasul. Încearcă din nou.',
    };
  }

  if (!activityTypeRow) {
    return { success: false, error: 'Tipul de activitate ales nu există' };
  }

  const { data, error } = await ctx.supabase
    .from('learning_path_steps')
    .insert({
      path_id: parsed.data.pathId,
      step_order: parsed.data.stepOrder,
      kind: 'activity_template',
      target_activity_type: parsed.data.targetActivityType,
      target_activity_config:
        parsed.data.targetActivityConfig === undefined
          ? {}
          : parsed.data.targetActivityConfig,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    })
    .select(LEARNING_PATH_STEP_SELECT)
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: 'Nu am putut adăuga pasul. Încearcă din nou.',
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
