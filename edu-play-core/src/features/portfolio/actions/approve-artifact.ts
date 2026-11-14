'use server';

import { z } from 'zod';
import type { ActionResult, Artifact } from '../types';
import { runVisibilityChange } from './internal/run-visibility-change';

const inputSchema = z.object({
  id: z.string().uuid('ID-ul artefactului este invalid'),
});

/**
 * Convenience wrapper that approves a submitted activity response for the
 * teacher/student-only v1 review flow. This intentionally does not publish to
 * family-visible surfaces.
 */
export async function approveArtifact(
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
    visibility: 'internal_teacher_only',
  });
}
