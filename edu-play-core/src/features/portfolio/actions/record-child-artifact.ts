'use server';

import { recordChildArtifactSchema } from '../schemas';
import type { ActionResult } from '../types';
import {
  runRecordChildArtifact,
  type RecordChildArtifactData,
} from './internal/run-record-artifact';

/**
 * Records a draft `child_artifacts` entry from a creative activity or game
 * completion. Generalizes Activity artifact capture to
 * cover both the F9 drawing canvas (PNG dataURL) and the F9 voice
 * recorder (audio Uint8Array) lifecycles.
 *
 * Runs with the student's session-bound Supabase client; storage and row
 * RLS confirm the caller is allowed to write under their own folder. The
 * service role is intentionally **not** used.
 *
 * Callers should treat artifact recording as best-effort: progress is the
 * source of truth, so wrap this in `try`/`catch` and never block the
 * primary save flow on its outcome.
 */
export async function recordChildArtifact(
  input: unknown,
): Promise<ActionResult<RecordChildArtifactData>> {
  const parsed = recordChildArtifactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Date invalide',
    };
  }

  return runRecordChildArtifact(parsed.data);
}
