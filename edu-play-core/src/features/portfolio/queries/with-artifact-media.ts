import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CHILD_ARTIFACTS_BUCKET,
  DEFAULT_ARTIFACT_SIGNED_URL_TTL_SECONDS,
} from '@/shared/lib/storage/artifact-signed-url';

/** Accept already-authorized rows. Scope and thumbnail selection stay with the read caller. */
export async function withArtifactMedia<T extends { storagePath: string }>(
  client: SupabaseClient,
  rows: readonly T[],
  expiresIn = DEFAULT_ARTIFACT_SIGNED_URL_TTL_SECONDS,
): Promise<Array<T & { mediaUrl: string | null }>> {
  const byPath = new Map<string, Promise<string | null>>();
  function sign(path: string): Promise<string | null> {
    let result = byPath.get(path);
    if (!result) {
      result = (async () => {
        try {
          const { data, error } = await client.storage
            .from(CHILD_ARTIFACTS_BUCKET)
            .createSignedUrl(path, expiresIn);
          return error ? null : (data?.signedUrl ?? null);
        } catch {
          return null;
        }
      })();
      byPath.set(path, result);
    }
    return result;
  }
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      mediaUrl: await sign(row.storagePath),
    })),
  );
}
