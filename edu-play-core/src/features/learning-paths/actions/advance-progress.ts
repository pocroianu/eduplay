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

/** Advances one authorised step; SQL owns cursor guards and the atomic write. */
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

  const { error } = await createAdminClient().rpc(
    'advance_learning_path_progress',
    {
      p_student_id: studentId,
      p_path_id: pathId,
      p_completed_step_id: completedStepId,
    },
  );
  if (error) throw new Error(error.message);
}
