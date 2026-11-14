import { describe, expect, it } from 'vitest';
import { getActivityInstance } from '../get-activity-instance';
import { fakeClient, makeActivityInstanceRow } from './fake-supabase';

const INSTANCE_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('getActivityInstance', () => {
  it('returns a mapped instance when the row exists', async () => {
    const row = makeActivityInstanceRow();
    const { client } = fakeClient({
      perTable: { activity_instances: [{ data: row, error: null }] },
    });

    const out = await getActivityInstance(client, INSTANCE_ID);
    expect(out?.id).toBe(row.id);
    expect(out?.typeId).toBe('drawing-canvas');
    expect(out?.assignedTo).toBe(row.assigned_to);
    expect(out?.classId).toBe(row.class_id);
  });

  it('returns null when the row is missing (RLS-hidden or 404)', async () => {
    const { client } = fakeClient({
      perTable: { activity_instances: [{ data: null, error: null }] },
    });
    expect(await getActivityInstance(client, INSTANCE_ID)).toBeNull();
  });

  it('throws when the underlying query errors', async () => {
    const { client } = fakeClient({
      perTable: {
        activity_instances: [{ data: null, error: { message: 'boom' } }],
      },
    });
    await expect(getActivityInstance(client, INSTANCE_ID)).rejects.toThrow(
      /boom/,
    );
  });

  it('returns null for a malformed (non-UUID) id without hitting the DB', async () => {
    const { client, fromCalls } = fakeClient({
      perTable: { activity_instances: [{ data: null, error: null }] },
    });
    expect(await getActivityInstance(client, 'not-a-uuid')).toBeNull();
    expect(fromCalls).toHaveLength(0);
  });
});
