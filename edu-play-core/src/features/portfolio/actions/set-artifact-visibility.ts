'use server';

import {
  setArtifactVisibilitySchema,
} from '../schemas';
import type { ActionResult, Artifact } from '../types';
import { runVisibilityChange } from './internal/run-visibility-change';

/**
 * Move an artifact to an arbitrary lifecycle state. Used by the teacher
 * review queue UI for transitions other than the common publish/archive
 * shortcuts.
 *
 * Authorization: requires `teacher` or `admin` role. RLS still scopes the
 * UPDATE to artifacts in the teacher's classes; this check is the
 * application-layer first line of defense.
 *
 * Audit: the `log_child_artifact_change()` trigger captures every
 * visibility change. Do not write to `audit_log` directly.
 */
export async function setArtifactVisibility(
  input: unknown,
): Promise<ActionResult<{ artifact: Artifact }>> {
  const parsed = setArtifactVisibilitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Date invalide',
    };
  }

  return runVisibilityChange(parsed.data);
}
