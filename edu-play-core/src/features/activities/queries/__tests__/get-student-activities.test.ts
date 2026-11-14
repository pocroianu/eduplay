import { describe, expect, it } from 'vitest';
import { fakeClient, makeActivityInstanceRow } from './fake-supabase';
import { getStudentActivities } from '../get-student-activities';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_STUDENT_ID = '22222222-2222-4222-8222-222222222222';

describe('getStudentActivities', () => {
  it('scopes activity rows to the requested student id', async () => {
    const row = makeActivityInstanceRow({
      assigned_to: STUDENT_ID,
      type_id: 'voice-recording',
      config: { promptText: 'Spune ceva despre primăvară' },
    });
    const { client, trace } = fakeClient({
      perTable: {
        activity_instances: [{ data: [row], error: null }],
      },
    });

    const out = await getStudentActivities(client, STUDENT_ID);

    expect(out).toEqual([
      expect.objectContaining({
        id: row.id,
        typeId: 'voice-recording',
        assignedTo: STUDENT_ID,
      }),
    ]);
    expect(trace.calls).toContainEqual({
      fn: 'eq',
      args: ['assigned_to', STUDENT_ID],
    });
    expect(trace.calls).toContainEqual({
      fn: 'order',
      args: ['created_at', { ascending: false }],
    });
  });

  it('returns an empty list for malformed student ids before querying', async () => {
    const { client, fromCalls } = fakeClient({
      perTable: {
        activity_instances: [
          {
            data: [makeActivityInstanceRow({ assigned_to: OTHER_STUDENT_ID })],
            error: null,
          },
        ],
      },
    });

    await expect(getStudentActivities(client, 'not-a-uuid')).resolves.toEqual([]);
    expect(fromCalls).toHaveLength(0);
  });
});
