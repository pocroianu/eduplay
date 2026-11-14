import { describe, expect, it } from 'vitest';
import { getArtifactById } from '../get-artifact-by-id';
import { fakeClient, makeArtifactRow } from './fake-supabase';

const ARTIFACT_ID = '11111111-1111-1111-1111-111111111111';

describe('getArtifactById', () => {
  it('returns a mapped artifact when the row exists', async () => {
    const row = makeArtifactRow();
    const { client } = fakeClient({
      perTable: { child_artifacts: [{ data: row, error: null }] },
    });

    const out = await getArtifactById(client, ARTIFACT_ID);
    expect(out?.id).toBe(row.id);
    expect(out?.artifactType).toBe('drawing');
  });

  it('returns null when the row is missing (RLS-hidden or 404)', async () => {
    const { client } = fakeClient({
      perTable: { child_artifacts: [{ data: null, error: null }] },
    });
    expect(await getArtifactById(client, ARTIFACT_ID)).toBeNull();
  });

  it('throws when the underlying query errors', async () => {
    const { client } = fakeClient({
      perTable: {
        child_artifacts: [{ data: null, error: { message: 'boom' } }],
      },
    });
    await expect(getArtifactById(client, ARTIFACT_ID)).rejects.toThrow(/boom/);
  });
});
