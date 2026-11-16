'use server';
import { submitNativeActivity } from '../../submission/native-submission-actions';
export async function submitVoiceRecordingArtifact(input: {
  instanceId: string;
  submissionId: string;
  blob: Uint8Array;
  mime: string;
  durationMs?: number;
}) {
  return submitNativeActivity({
    instanceId: input.instanceId,
    submissionId: input.submissionId,
    kind: 'audio',
    payload: { blob: input.blob, mime: input.mime },
    durationMs: input.durationMs,
  });
}
