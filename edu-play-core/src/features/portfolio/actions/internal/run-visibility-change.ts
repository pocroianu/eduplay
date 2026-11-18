// Internal helper shared by `setArtifactVisibility`, `publishArtifact`, and
// `archiveArtifact`. Kept outside any `'use server'` file so it is not
// exposed as a public RPC endpoint.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';
import { revalidatePath } from 'next/cache';
import { ROUTES } from '@/shared/lib/constants/routes';
import { ApiError, requireRole } from '@/lib/api';
import type { SetArtifactVisibilityInput } from '../../schemas';
import type { ActionResult, Artifact } from '../../types';
import {
  mapArtifactRow,
  type ArtifactRow,
} from '../../queries/types';
import { notifyArtifactPublished } from './notify-artifact-published';

export interface VisibilityChangeData {
  artifact: Artifact;
}

export async function runVisibilityChange(
  input: SetArtifactVisibilityInput,
): Promise<ActionResult<VisibilityChangeData>> {
  let supabase: SupabaseClient<Database>;
  try {
    const ctx = await requireRole('teacher', 'admin');
    supabase = ctx.supabase;
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

  const { data, error } = await supabase
    .rpc('change_artifact_visibility', {
      p_artifact_id: input.id,
      p_visibility: input.visibility,
    })
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

  const row = data.artifact as unknown as ArtifactRow;

  // Fan out `artifact_published` notifications only on a real transition into
  // the family feed. Errors inside notifyArtifactPublished are logged but do
  // not break the publish contract.
  if (data.became_family_visible) {
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
  revalidatePath(ROUTES.TEACHER.PORTFOLIO);
  if (input.visibility === 'family_visible') {
    revalidatePath(ROUTES.PARENT.DASHBOARD);
  }

  return {
    success: true,
    data: { artifact: mapArtifactRow(row) },
  };
}
