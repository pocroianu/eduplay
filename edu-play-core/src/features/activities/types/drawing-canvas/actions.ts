'use server';

import { MAX_SCREENSHOT_BYTES, recordChildArtifact } from '@/features/portfolio';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { advanceActivityCompletionProgress } from '@/features/learning-paths/server';
import { activityInstanceIdSchema } from '../../schemas';

interface SubmitDrawingInput {
  instanceId: string;
  dataUrl: string;
}

// Roughly the longest legal `data:image/png;base64,…` string. The schema
// enforces the same cap inside `recordChildArtifact`; checking here is a
// cheap fast-fail so a manipulated client can't make us round-trip a
// multi-megabyte body before validation rejects it.
const MAX_SCREENSHOT_DATA_URL_LENGTH =
  'data:image/png;base64,'.length +
  Math.ceil((MAX_SCREENSHOT_BYTES * 4) / 3) +
  4;

/**
 * Thin server-action wrapper around `recordChildArtifact` so the
 * drawing-canvas client renderer can submit without having to know its own
 * `studentId`. The action derives the id from the session and threads the
 * activity instance id through `sourceRef` for attribution.
 *
 * Returns the same `ActionResult` shape as `recordChildArtifact` so the
 * renderer can branch on `success`/`error` directly.
 */
export async function submitDrawingArtifact(input: SubmitDrawingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: 'Nu ești autentificat' };
  }

  if (
    typeof input.dataUrl !== 'string' ||
    input.dataUrl.length === 0 ||
    input.dataUrl.length > MAX_SCREENSHOT_DATA_URL_LENGTH
  ) {
    return {
      success: false as const,
      error: 'Captura de ecran este invalidă sau prea mare',
    };
  }

  const parsedInstance = activityInstanceIdSchema.safeParse({
    id: input.instanceId,
  });
  if (!parsedInstance.success) {
    return { success: false as const, error: 'Activitatea este invalidă' };
  }

  const { data: instance, error: instanceError } = await supabase
    .from('activity_instances')
    .select('id')
    .eq('id', parsedInstance.data.id)
    .eq('assigned_to', user.id)
    .eq('type_id', 'drawing-canvas')
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
    kind: 'drawing',
    studentId: user.id,
    payload: { dataUrl: input.dataUrl },
    sourceRef: parsedInstance.data.id,
    metadata: {
      activityInstanceId: parsedInstance.data.id,
      activityTypeId: 'drawing-canvas',
      activityTitle: 'Desen liber',
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
      },
    })
    .eq('id', parsedInstance.data.id)
    .eq('assigned_to', user.id)
    .eq('type_id', 'drawing-canvas');

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
