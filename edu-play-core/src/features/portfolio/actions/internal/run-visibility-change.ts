// Internal helper shared by `setArtifactVisibility`, `publishArtifact`, and
// `archiveArtifact`. Kept outside any `'use server'` file so it is not
// exposed as a public RPC endpoint.

import 'server-only';
import { revalidatePath } from 'next/cache';
import { ApiError, requireRole } from '@/lib/api';
import type { SetArtifactVisibilityInput } from '../../schemas';
import type { ActionResult, Artifact, ArtifactVisibility } from '../../types';
import {
  ARTIFACT_SELECT,
  mapArtifactRow,
  type ArtifactRow,
} from '../../queries/types';
import { notifyArtifactPublished } from './notify-artifact-published';

export interface VisibilityChangeData {
  artifact: Artifact;
}

const VISIBILITIES_THAT_RECORD_REVIEW: ArtifactVisibility[] = [
  'family_visible',
  'internal_teacher_only',
  'archived',
];

export async function runVisibilityChange(
  input: SetArtifactVisibilityInput,
): Promise<ActionResult<VisibilityChangeData>> {
  let supabase;
  let actorId: string;
  try {
    const ctx = await requireRole('teacher', 'admin');
    supabase = ctx.supabase;
    actorId = ctx.user.id;
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        success: false,
        error:
          err.code === 'FORBIDDEN'
            ? 'Nu ai permisiunea să modifici acest artefact'
            : 'Nu ești autentificat',
      };
    }
    throw err;
  }

  // Pre-read the prior visibility so the notification fan-out can gate on
  // the actual draft → family_visible transition. Without this, an idempotent
  // re-publish (retry, double-tap, two browser tabs) would spam every linked
  // parent with a duplicate `artifact_published` notification. RLS may hide
  // this row from the caller — when it does we treat the artifact as
  // "not previously published" so a subsequent successful UPDATE still gets
  // its first-time notification.
  const { data: priorRow } = await supabase
    .from('child_artifacts')
    .select('visibility')
    .eq('id', input.id)
    .maybeSingle();
  const wasAlreadyPublished =
    (priorRow as { visibility: ArtifactVisibility } | null)?.visibility ===
    'family_visible';

  const update: {
    visibility: ArtifactVisibility;
    reviewed_by?: string;
    reviewed_at?: string;
  } = { visibility: input.visibility };

  if (VISIBILITIES_THAT_RECORD_REVIEW.includes(input.visibility)) {
    update.reviewed_by = actorId;
    update.reviewed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('child_artifacts')
    .update(update)
    .eq('id', input.id)
    .select(ARTIFACT_SELECT)
    .maybeSingle();

  if (error) {
    return {
      success: false,
      error: 'Eroare la actualizarea artefactului',
    };
  }

  if (!data) {
    return {
      success: false,
      error: 'Artefactul nu a fost găsit',
    };
  }

  const row = data as ArtifactRow;

  // Fan out `artifact_published` notifications only on a real transition into
  // the family feed. Errors inside notifyArtifactPublished are logged but do
  // not break the publish contract.
  if (input.visibility === 'family_visible' && !wasAlreadyPublished) {
    await notifyArtifactPublished({
      supabase,
      artifact: {
        id: row.id,
        student_id: row.student_id,
        title: row.title,
        artifact_type: row.artifact_type,
      },
    });
  }

  // The teacher inbox reads every draft decision; parent surfaces only need
  // invalidation when a response is truly published to the family feed.
  revalidatePath('/teacher/portfolio');
  if (input.visibility === 'family_visible') {
    revalidatePath('/parent');
  }

  return {
    success: true,
    data: { artifact: mapArtifactRow(row) },
  };
}
