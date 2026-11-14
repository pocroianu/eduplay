'use server';

import { recordActivityArtifactSchema } from '../schemas';
import type { ActionResult } from '../types';
import {
  runRecordChildArtifact,
  type RecordChildArtifactData,
} from './internal/run-record-artifact';

/**
 * Records a draft `child_artifacts` entry from an Activity renderer completion
 * event. Progress remains the source of truth; callers should treat this as a
 * best-effort side-effect and never block completion on it.
 */
export async function recordActivityArtifact(
  input: unknown,
): Promise<ActionResult<RecordChildArtifactData>> {
  const parsed = recordActivityArtifactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Date invalide',
    };
  }

  const { studentId, activityId, versionId, assignmentId, screenshotDataUrl, score } = parsed.data;

  return runRecordChildArtifact({
    kind: 'drawing',
    studentId,
    payload: { dataUrl: screenshotDataUrl },
    sourceRef: activityId,
    metadata: {
      activityId,
      ...(versionId ? { versionId } : {}),
      ...(assignmentId ? { assignmentId } : {}),
      ...(score !== undefined ? { score } : {}),
    },
  });
}
