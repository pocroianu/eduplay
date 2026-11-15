import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Artifact } from '../types';
import { withArtifactMedia } from './with-artifact-media';
export async function getSignedUrlsForArtifacts(client: SupabaseClient, artifacts: Artifact[], expiresIn?: number): Promise<Record<string, string | null>> {
  const rows = await withArtifactMedia(client, artifacts, expiresIn);
  return Object.fromEntries(rows.map(row => [row.id, row.mediaUrl]));
}
