'use server';

import { revalidatePath } from 'next/cache';
import { ROUTES } from '@/shared/lib/constants';
import { reorderStepsInputSchema } from '../schemas';
import type { ActionResult } from '../types';
import { requireTeacher } from './internal/require-teacher';

interface ReorderedStepRow {
  id: string;
  step_order: number;
}

function reorderErrorMessage(message: string | undefined) {
  if (message?.includes('learning_path_not_found')) {
    return 'Parcursul nu există';
  }

  if (message?.includes('learning_path_not_draft')) {
    return 'Nu poți reordona pașii unui parcurs publicat sau arhivat';
  }

  if (message?.includes('learning_path_step_mismatch')) {
    return 'Lista de pași nu se potrivește cu parcursul';
  }

  return 'Nu am putut reordona pașii. Încearcă din nou.';
}

/**
 * Rewrites all `step_order` values for a draft path after the teacher builder
 * reorders steps. Published and archived paths are immutable for the same
 * reason as `addStep`: student progress rows point at a frozen ordered list.
 */
export async function reorderSteps(
  input: unknown,
): Promise<ActionResult<{ orderedStepIds: string[] }>> {
  const parsed = reorderStepsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Date invalide',
    };
  }

  const auth = await requireTeacher();
  if (!auth.ok) return auth.error;

  const { ctx } = auth;
  const { pathId, orderedStepIds } = parsed.data;

  const { data, error } = await ctx.supabase.rpc('reorder_learning_path_steps', {
    p_path_id: pathId,
    p_ordered_step_ids: orderedStepIds,
  });

  if (error || !data) {
    return {
      success: false,
      error: reorderErrorMessage(error?.message),
    };
  }

  revalidatePath(ROUTES.TEACHER.PATH(pathId));

  const reorderedRows = data as ReorderedStepRow[];

  return {
    success: true,
    data: { orderedStepIds: reorderedRows.map((step) => step.id) },
  };
}
