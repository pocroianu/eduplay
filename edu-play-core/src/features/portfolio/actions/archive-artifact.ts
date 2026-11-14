'use server';

import { z } from 'zod';
import type { ActionResult, Artifact } from '../types';
import { runVisibilityChange } from './internal/run-visibility-change';

const inputSchema = z.object({
  id: z.string().uuid('ID-ul artefactului este invalid'),
});

/**
 * Convenience wrapper that flips an artifact to `archived`. Used by the
 * teacher review queue when the captured artifact is unsuitable for the
 * family feed.
 */
export async function archiveArtifact(
  input: unknown,
): Promise<ActionResult<{ artifact: Artifact }>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Date invalide',
    };
  }

  return runVisibilityChange({
    id: parsed.data.id,
    visibility: 'archived',
  });
}
