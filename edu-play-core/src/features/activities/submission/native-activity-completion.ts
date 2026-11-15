import 'server-only';

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';
import { decodeArtifactPayload } from '@/features/portfolio/server';
import { recordChildArtifactSchema } from '@/features/portfolio';
import type {
  NativeSubmissionReceipt,
  NativeSubmissionResult,
} from './native-submission-types';

type Client = SupabaseClient<Database>;
type Media =
  | { kind: 'drawing'; payload: { dataUrl: string } }
  | {
      kind: 'audio';
      payload: { blob: Uint8Array; mime: string };
      durationMs?: number;
    };
export type NativeSubmissionInput = Media & {
  instanceId: string;
  submissionId: string;
};
const identity = z.object({ instanceId: z.uuid(), submissionId: z.uuid() });

/** Both media adapters cross this seam; SQL owns receipts and target settlement. */
export async function completeNativeActivity(
  client: Client,
  admin: () => Client,
  studentId: string,
  input: NativeSubmissionInput,
): Promise<NativeSubmissionResult> {
  if (!identity.safeParse(input).success)
    return {
      success: false,
      canEdit: true,
      error: 'Activitatea este invalidă',
    };
  if (
    input.kind === 'audio' &&
    input.durationMs !== undefined &&
    !z.number().int().min(0).max(2147483647).safeParse(input.durationMs).success
  ) {
    return {
      success: false,
      canEdit: true,
      error: 'Durata înregistrării este invalidă',
    };
  }
  const typeId =
    input.kind === 'drawing' ? 'drawing-canvas' : 'voice-recording';
  const { data: instance, error } = await client
    .from('activity_instances')
    .select('id')
    .eq('id', input.instanceId)
    .eq('assigned_to', studentId)
    .eq('type_id', typeId)
    .maybeSingle();
  if (error || !instance)
    return {
      success: false,
      error: 'Activitatea nu este disponibilă pentru acest cont',
    };

  const existing = await readNativeSubmission(
    client,
    input.instanceId,
    input.submissionId,
  );
  if (existing)
    return {
      success: true,
      data: await settleNativeSubmission(admin(), studentId, existing),
    };
  const parsed = recordChildArtifactSchema.safeParse({ ...input, studentId });
  const media = parsed.success ? decodeArtifactPayload(parsed.data) : null;
  if (!media)
    return {
      success: false,
      canEdit: true,
      error: 'Fișierul este invalid sau prea mare',
    };
  const { data: student, error: studentError } = await client
    .from('students')
    .select('consents')
    .eq('id', studentId)
    .maybeSingle();
  if (studentError)
    return {
      success: false,
      canEdit: true,
      error: 'Nu am putut verifica acordul părintelui',
    };
  const consents = student?.consents;
  if (
    input.kind === 'audio' &&
    (!consents ||
      typeof consents !== 'object' ||
      Array.isArray(consents) ||
      consents.audio_recording !== true)
  ) {
    return {
      success: false,
      error: 'Avem nevoie de acordul părintelui pentru înregistrări audio',
      canEdit: true,
    };
  }
  const storagePath = `${studentId}/${crypto.randomUUID()}.${media.extension}`;
  const uploaded = await client.storage
    .from('child-artifacts')
    .upload(storagePath, media.bytes, {
      contentType: media.contentType,
      upsert: false,
    });
  if (uploaded.error)
    return {
      success: false,
      error: 'Nu am putut încărca fișierul. Încearcă din nou.',
      canEdit: true,
    };
  const privileged = admin();
  try {
    const { data, error: commitError } = await privileged.rpc(
      'accept_native_activity_submission',
      {
        p_student_id: studentId,
        p_instance_id: input.instanceId,
        p_submission_id: input.submissionId,
        p_type_id: typeId,
        p_storage_path: storagePath,
        p_duration_ms: input.kind === 'audio' ? input.durationMs : undefined,
      },
    );
    if (commitError || !data) throw new Error('Submission outcome uncertain');
    // Only a confirmed losing upload is safe to remove. Never delete on an
    // uncertain commit: the object may already back a saved Portfolio artifact.
    try {
      const { data: artifact } = await client
        .from('child_artifacts')
        .select('storage_path')
        .eq('id', data.artifact_id)
        .maybeSingle();
      if (artifact && artifact.storage_path !== storagePath) {
        const removed = await privileged.storage
          .from('child-artifacts')
          .remove([storagePath]);
        if (removed.error)
          console.warn('Unable to remove redundant Activity upload');
      }
    } catch {
      // Cleanup cannot turn a confirmed saved submission into a failure.
      console.warn('Unable to remove redundant Activity upload');
    }
    const receipt = {
      submissionId: data.id,
      artifactId: data.artifact_id,
      progressionPending: true,
    };
    return {
      success: true,
      data: await settleNativeSubmission(privileged, studentId, receipt),
    };
  } catch {
    // A lost response is reconciled through the same durable submission key.
    const committed = await readNativeSubmission(
      client,
      input.instanceId,
      input.submissionId,
    );
    if (committed)
      return {
        success: true,
        data: await settleNativeSubmission(privileged, studentId, committed),
      };
    return {
      success: false,
      error: 'Nu am putut confirma salvarea. Încearcă din nou.',
    };
  }
}

export async function readNativeSubmission(
  client: Client,
  instanceId: string,
  submissionId: string,
): Promise<NativeSubmissionReceipt | null> {
  const { data, error } = await client
    .from('native_activity_submissions')
    .select('id,artifact_id,native_activity_submission_targets(settled)')
    .eq('instance_id', instanceId)
    .eq('id', submissionId)
    .maybeSingle();
  if (error) throw new Error('Unable to read saved submission');
  if (!data) return null;
  return {
    submissionId: data.id,
    artifactId: data.artifact_id,
    progressionPending: data.native_activity_submission_targets.some(
      (target) => !target.settled,
    ),
  };
}

export async function settleNativeSubmission(
  admin: Client,
  studentId: string,
  receipt: NativeSubmissionReceipt,
): Promise<NativeSubmissionReceipt> {
  if (!receipt.progressionPending) return receipt;
  try {
    const { error } = await admin.rpc('retry_native_activity_progress', {
      p_student_id: studentId,
      p_submission_id: receipt.submissionId,
    });
    return { ...receipt, progressionPending: !!error };
  } catch {
    return { ...receipt, progressionPending: true };
  }
}
