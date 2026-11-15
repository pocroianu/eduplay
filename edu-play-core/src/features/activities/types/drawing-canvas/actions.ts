'use server';
import { submitNativeActivity } from '../../submission/native-submission-actions';
export async function submitDrawingArtifact(input: {
  instanceId: string;
  submissionId: string;
  dataUrl: string;
}) {
  return submitNativeActivity({
    instanceId: input.instanceId,
    submissionId: input.submissionId,
    kind: 'drawing',
    payload: { dataUrl: input.dataUrl },
  });
}
