import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { Database } from '@/shared/types/database';
import { advanceProgressInputSchema } from '../schemas';
import type { AdvanceProgressInput } from '../schemas';

export type EduplaySupabaseClient = Pick<SupabaseClient<Database>, 'from'>;

type StepRow = Pick<
  Database['public']['Tables']['learning_path_steps']['Row'],
  'id' | 'path_id' | 'step_order'
>;

type ProgressRow = Pick<
  Database['public']['Tables']['student_path_progress']['Row'],
  | 'id'
  | 'student_id'
  | 'path_id'
  | 'current_step_id'
  | 'last_completed_step_id'
  | 'status'
  | 'started_at'
  | 'completed_at'
>;

/**
 * Advances a student's progress along a path after a step completes.
 *
 * Pattern A — server-only, idempotent. Throws on every input failure
 * mode so the auto-progression hook (EDU-31.F) can lift the throw to a
 * real INSERT/UPDATE without rewriting any of the validation surface.
 *
 * v1 is linear: completing a step moves `current_step_id` to the next
 * `step_order` row, or marks the whole path completed when no next row exists.
 */
export async function advanceProgress(input: unknown): Promise<void> {
  const parsed = advanceProgressInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ??
        'Datele pentru avansarea progresului sunt invalide',
    );
  }

  const supabase = await createClient();
  await runAdvanceProgress(supabase, parsed.data);
}

export async function runAdvanceProgress(
  supabase: EduplaySupabaseClient,
  input: AdvanceProgressInput,
): Promise<void> {
  const { studentId, pathId, completedStepId } = input;
  const { data: completedStep, error: completedStepError } = await supabase
    .from('learning_path_steps')
    .select('id, path_id, step_order')
    .eq('id', completedStepId)
    .eq('path_id', pathId)
    .maybeSingle<StepRow>();

  if (completedStepError) {
    throw new Error(completedStepError.message);
  }

  if (!completedStep) {
    throw new Error('Pasul finalizat nu aparține parcursului');
  }

  const { data: nextStep, error: nextStepError } = await supabase
    .from('learning_path_steps')
    .select('id, path_id, step_order')
    .eq('path_id', pathId)
    .gt('step_order', completedStep.step_order)
    .order('step_order', { ascending: true })
    .limit(1)
    .maybeSingle<StepRow>();

  if (nextStepError) {
    throw new Error(nextStepError.message);
  }

  const { data: existingProgress, error: existingProgressError } =
    await supabase
      .from('student_path_progress')
      .select(
        'id, student_id, path_id, current_step_id, last_completed_step_id, status, started_at, completed_at',
      )
      .eq('student_id', studentId)
      .eq('path_id', pathId)
      .maybeSingle<ProgressRow>();

  if (existingProgressError) {
    throw new Error(existingProgressError.message);
  }

  if (
    existingProgress?.last_completed_step_id === completedStepId ||
    existingProgress?.status === 'completed' ||
    existingProgress?.status === 'overridden'
  ) {
    return;
  }

  if (
    existingProgress?.current_step_id &&
    existingProgress.current_step_id !== completedStepId
  ) {
    return;
  }

  if (!existingProgress?.current_step_id) {
    const { data: previousStep, error: previousStepError } = await supabase
      .from('learning_path_steps')
      .select('id')
      .eq('path_id', pathId)
      .lt('step_order', completedStep.step_order)
      .order('step_order', { ascending: false })
      .limit(1)
      .maybeSingle<Pick<StepRow, 'id'>>();

    if (previousStepError) {
      throw new Error(previousStepError.message);
    }

    if (previousStep) {
      return;
    }
  }

  const now = new Date().toISOString();
  const startedAt = existingProgress?.started_at ?? now;
  const payload = nextStep
    ? {
        student_id: studentId,
        path_id: pathId,
        current_step_id: nextStep.id,
        last_completed_step_id: completedStepId,
        status: 'in_progress',
        started_at: startedAt,
        completed_at: null,
        updated_at: now,
      }
    : {
        student_id: studentId,
        path_id: pathId,
        current_step_id: null,
        last_completed_step_id: completedStepId,
        status: 'completed',
        started_at: startedAt,
        completed_at: existingProgress?.completed_at ?? now,
        updated_at: now,
      };

  const adminSupabase = createAdminClient();
  const { error: upsertError } = await adminSupabase
    .from('student_path_progress')
    .upsert(payload, { onConflict: 'student_id,path_id' })
    .select('id')
    .maybeSingle();

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}
