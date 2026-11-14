'use server';

import { recordGameArtifactSchema } from '../schemas';
import type { ActionResult } from '../types';
import {
  runRecordChildArtifact,
  type RecordChildArtifactData,
} from './internal/run-record-artifact';

/**
 * Records a draft `child_artifacts` entry from a game completion event.
 *
 * Called by the host shell (`GameEmbed`) when the iframe posts a
 * `GAME_COMPLETE` message that includes a `screenshotDataUrl`. Thin
 * wrapper over `recordChildArtifact`/`runRecordChildArtifact` (EDU-292)
 * that preserves the EDU-273 contract: same input shape, same result.
 *
 * Game progress is the source of truth — callers must wrap this in
 * `try`/`catch` and never block `saveProgress` on its outcome.
 */
export async function recordGameArtifact(
  input: unknown,
): Promise<ActionResult<RecordChildArtifactData>> {
  const parsed = recordGameArtifactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Date invalide',
    };
  }

  return runRecordChildArtifact({
    kind: 'drawing',
    studentId: parsed.data.studentId,
    payload: { dataUrl: parsed.data.screenshotDataUrl },
    sourceRef: parsed.data.gameId,
  });
}
