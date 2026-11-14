'use server';

import { recordChildArtifact } from '@/features/portfolio/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { advanceActivityCompletionProgress } from '@/features/learning-paths/server';
import { activityInstanceIdSchema } from '../../schemas';

interface SubmitVoiceRecordingInput {
  instanceId: string;
  blob: Uint8Array;
  mime: string;
  durationMs?: number;
}

export async function submitVoiceRecordingArtifact(input: SubmitVoiceRecordingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: 'Nu ești autentificat' };
  }

  const parsedInstance = activityInstanceIdSchema.safeParse({
    id: input.instanceId,
  });
  if (!parsedInstance.success) {
    return { success: false as const, error: 'Activitatea este invalidă' };
  }

  if (!(input.blob instanceof Uint8Array) || input.blob.byteLength === 0) {
    return { success: false as const, error: 'Înregistrarea este invalidă' };
  }

  const { data: instance, error: instanceError } = await supabase
    .from('activity_instances')
    .select('id')
    .eq('id', parsedInstance.data.id)
    .eq('assigned_to', user.id)
    .eq('type_id', 'voice-recording')
    .maybeSingle();

  if (instanceError) {
    return {
      success: false as const,
      error: 'Nu am putut verifica activitatea',
    };
  }

  if (!instance) {
    return {
      success: false as const,
      error: 'Activitatea nu este disponibilă pentru acest cont',
    };
  }

  const recordResult = await recordChildArtifact({
    kind: 'audio',
    studentId: user.id,
    payload: { blob: input.blob, mime: input.mime },
    sourceRef: parsedInstance.data.id,
    metadata: {
      activityInstanceId: parsedInstance.data.id,
      activityTypeId: 'voice-recording',
      activityTitle: 'Înregistrare vocală',
      durationMs: input.durationMs ?? null,
    },
  });

  if (!recordResult.success) {
    return recordResult;
  }

  const adminSupabase = createAdminClient();
  const { error: completionError } = await adminSupabase
    .from('activity_instances')
    .update({
      result_summary: {
        status: 'completed',
        artifactId: recordResult.data?.artifactId ?? '',
        durationMs: input.durationMs ?? null,
      },
    })
    .eq('id', parsedInstance.data.id)
    .eq('assigned_to', user.id)
    .eq('type_id', 'voice-recording');

  if (completionError) {
    return {
      success: false as const,
      error: 'Nu am putut marca activitatea ca finalizată',
    };
  }

  await advanceActivityCompletionProgress(supabase, {
    activityInstanceId: parsedInstance.data.id,
  });

  return recordResult;
}
