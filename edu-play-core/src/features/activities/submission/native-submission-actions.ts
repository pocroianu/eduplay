'use server';

import { z } from 'zod';
import { requireRole } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/server';
import {
  completeNativeActivity,
  settleNativeSubmission,
  type NativeSubmissionInput,
} from './native-activity-completion';
import type {
  NativeSubmissionReceipt,
  NativeSubmissionResult,
} from './native-submission-types';

export async function submitNativeActivity(
  input: NativeSubmissionInput,
): Promise<NativeSubmissionResult> {
  try {
    const { supabase, user } = await requireRole('student');
    return await completeNativeActivity(
      supabase,
      createAdminClient,
      user.id,
      input,
    );
  } catch {
    return {
      success: false,
      error: 'Nu am putut confirma salvarea. Încearcă din nou.',
    };
  }
}

/** Reopening an instance resumes saved work, without needing media bytes. */
export async function recoverNativeActivity(
  instanceId: string,
): Promise<NativeSubmissionReceipt[]> {
  if (!z.uuid().safeParse(instanceId).success)
    throw new Error('Activitate invalidă');
  const { supabase, user } = await requireRole('student');
  const { data, error } = await supabase
    .from('native_activity_submissions')
    .select('id,artifact_id,native_activity_submission_targets(settled)')
    .eq('instance_id', instanceId)
    .eq('student_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Nu am putut verifica salvarea');
  const receipts: NativeSubmissionReceipt[] = [];
  const admin = createAdminClient();
  for (const row of data ?? []) {
    const receipt = {
      submissionId: row.id,
      artifactId: row.artifact_id,
      progressionPending: row.native_activity_submission_targets.some(
        (target) => !target.settled,
      ),
    };
    receipts.push(await settleNativeSubmission(admin, user.id, receipt));
  }
  return receipts;
}
