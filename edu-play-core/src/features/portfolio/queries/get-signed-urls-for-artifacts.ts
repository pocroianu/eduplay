import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CHILD_ARTIFACTS_BUCKET,
  DEFAULT_ARTIFACT_SIGNED_URL_TTL_SECONDS,
} from '@/shared/lib/storage/artifact-signed-url';
import type { Artifact } from '../types';

export async function getSignedUrlsForArtifacts(
  supabase: SupabaseClient,
  artifacts: Artifact[],
  expiresIn: number = DEFAULT_ARTIFACT_SIGNED_URL_TTL_SECONDS,
): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    artifacts.map(async (artifact) => {
      const { data, error } = await supabase.storage
        .from(CHILD_ARTIFACTS_BUCKET)
        .createSignedUrl(artifact.storagePath, expiresIn);

      return [artifact.id, error || !data?.signedUrl ? null : data.signedUrl] as const;
    }),
  );

  return Object.fromEntries(entries);
}
