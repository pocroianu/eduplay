import { cleanupFreeResponseArtifacts, recordFreeResponseArtifact } from '../actions/record-free-response-artifact';
import { createFreeResponseSubmission, type SubmissionTarget } from './free-response-submission';

export class SubmissionRequestError extends Error {
  constructor(public readonly status: number) { super('Nu am putut salva răspunsul.'); }
}

export async function recordSubmission(input: SubmissionTarget & {
  intent: 'start' | 'submit'; response: Record<string, unknown>;
}) {
  const response = await fetch('/api/v1/activity-submissions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new SubmissionRequestError(response.status);
  return response.json() as Promise<{ data?: { status?: 'draft' | 'submitted' | 'needs_revision' | 'approved'; latestResponse?: unknown } }>;
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });
}

export function createBrowserFreeResponseSubmission(expected: Partial<SubmissionTarget>) {
  function target(input: SubmissionTarget): SubmissionTarget {
    if (input.activityId !== expected.activityId || input.assignmentId !== expected.assignmentId || input.versionId !== expected.versionId) {
      throw new Error('Submission context changed');
    }
    return { activityId: input.activityId, versionId: input.versionId, assignmentId: input.assignmentId };
  }
  return createFreeResponseSubmission({
    async drawing(input) {
      if (!input.drawingDataUrl) throw new Error('Missing drawing preview');
      const result = await recordFreeResponseArtifact({ ...target(input), kind: 'drawing',
        dataUrl: input.drawingDataUrl, drawingState: { strokes: input.strokes } });
      if (!result.success) throw new Error('Drawing upload failed');
      return result.data.artifactId;
    },
    async voice(input) {
      const result = await recordFreeResponseArtifact({ ...target(input), kind: 'audio',
        blob: await blobToBytes(input.voiceBlob!), mime: input.voiceMime!, durationMs: input.voiceDurationMs ?? undefined });
      if (!result.success) throw new Error('Voice upload failed');
      return result.data.artifactId;
    },
    async commit(context, response) {
      try {
        await recordSubmission({ ...target(context), intent: 'submit', response });
        return 'submitted';
      } catch (error) {
        // A server failure or a lost response can occur after a committed write.
        if (error instanceof SubmissionRequestError && error.status >= 400 && error.status < 500
          && error.status !== 408 && error.status !== 409) return 'rejected';
        return 'unknown';
      }
    },
    async lookup(context) {
      const response = await fetch(`/api/v1/activity-submissions?${new URLSearchParams({ assignmentId: target(context).assignmentId })}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error('Submission lookup failed');
      const result = await response.json();
      return result.data ?? null;
    },
    async cleanup(context, artifactIds) {
      return (await cleanupFreeResponseArtifacts({ assignmentId: target(context).assignmentId, artifactIds })).success;
    },
  });
}
