import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Artifact } from '../types';
import { ARTIFACT_SELECT, mapArtifactRow, type ArtifactRow } from './types';

/**
 * Fetches a single artifact by id. RLS decides whether the calling user
 * may see the row at all; missing rows return `null` so callers can render
 * a 404 without a thrown error.
 */
export async function getArtifactById(
  supabase: SupabaseClient,
  id: string,
): Promise<Artifact | null> {
  const { data, error } = await supabase
    .from('child_artifacts')
    .select(ARTIFACT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`getArtifactById failed: ${error.message}`);
  }

  if (!data) return null;

  return mapArtifactRow(data as ArtifactRow);
}
