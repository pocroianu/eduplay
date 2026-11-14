import { describe, expect, it } from 'vitest';
import { getFamilyVisibleArtifactsForChild } from '../get-family-visible-artifacts-for-child';
import { fakeClient, makeArtifactRow } from './fake-supabase';

const STUDENT_ID = '22222222-2222-2222-2222-222222222222';

describe('getFamilyVisibleArtifactsForChild', () => {
  it('returns only family_visible rows from the DB call result', async () => {
    const row = makeArtifactRow({
      visibility: 'family_visible',
      reviewed_at: '2026-05-01T10:00:00Z',
    });
    const { client } = fakeClient({
      perTable: { child_artifacts: [{ data: [row], error: null }] },
    });

    const out = await getFamilyVisibleArtifactsForChild(client, STUDENT_ID);
    expect(out).toHaveLength(1);
    expect(out[0].visibility).toBe('family_visible');
  });

  it('filters by student_id and visibility=family_visible', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getFamilyVisibleArtifactsForChild(client, STUDENT_ID);

    const eqs = trace.calls.filter((c) => c.fn === 'eq');
    expect(eqs).toEqual(
      expect.arrayContaining([
        { fn: 'eq', args: ['student_id', STUDENT_ID] },
        { fn: 'eq', args: ['visibility', 'family_visible'] },
      ]),
    );
  });

  it('orders by reviewed_at desc with id as a stable tie-break', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getFamilyVisibleArtifactsForChild(client, STUDENT_ID);

    const orders = trace.calls.filter((c) => c.fn === 'order');
    expect(orders).toEqual([
      {
        fn: 'order',
        args: ['reviewed_at', { ascending: false, nullsFirst: false }],
      },
      { fn: 'order', args: ['id', { ascending: false }] },
    ]);
  });

  it('throws when the underlying query errors', async () => {
    const { client } = fakeClient({
      perTable: {
        child_artifacts: [{ data: null, error: { message: 'rls denied' } }],
      },
    });
    await expect(
      getFamilyVisibleArtifactsForChild(client, STUDENT_ID),
    ).rejects.toThrow(/rls denied/);
  });
});
