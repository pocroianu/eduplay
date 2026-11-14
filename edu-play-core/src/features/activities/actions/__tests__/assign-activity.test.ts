import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClientMock(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { assignActivity } from '../assign-activity';

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const CLASS_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_CLASS_ID = '33333333-3333-4333-8333-333333333333';
const STUDENT_ONE = '44444444-4444-4444-8444-444444444444';
const STUDENT_TWO = '55555555-5555-4555-8555-555555555555';
const INSTANCE_ONE = '66666666-6666-4666-8666-666666666666';
const INSTANCE_TWO = '77777777-7777-4777-8777-777777777777';

interface QueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface Capture {
  inserts: Array<{ table: string; payload: unknown }>;
  calls: Array<{ table: string; fn: string; args: unknown[] }>;
}

function makeBuilder(
  table: string,
  result: QueryResult,
  capture: Capture,
) {
  const builder: Record<string, unknown> = {};
  for (const fn of ['select', 'eq', 'in', 'order', 'limit']) {
    builder[fn] = vi.fn((...args: unknown[]) => {
      capture.calls.push({ table, fn, args });
      return builder;
    });
  }
  builder.insert = vi.fn((payload: unknown) => {
    capture.inserts.push({ table, payload });
    capture.calls.push({ table, fn: 'insert', args: [payload] });
    return builder;
  });
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

function makeSupabase(
  perTable: Record<string, QueryResult[]>,
  capture: Capture,
) {
  const seen: Record<string, number> = {};

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: TEACHER_ID, email: 'teacher@example.test' } },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      const queue = perTable[table];
      if (!queue?.length) throw new Error(`unexpected table ${table}`);
      const idx = seen[table] ?? 0;
      if (idx >= queue.length) throw new Error(`no more results for ${table}`);
      seen[table] = idx + 1;
      return makeBuilder(table, queue[idx], capture);
    }),
  };
}

function teacherProfile(): QueryResult {
  return {
    data: { id: TEACHER_ID, role: 'teacher', full_name: 'Profesoara' },
    error: null,
  };
}

beforeEach(() => {
  createClientMock.mockReset();
  revalidatePathMock.mockReset();
});

describe('assignActivity', () => {
  it('rejects inputs without exactly one target kind', async () => {
    const result = await assignActivity({
      activityTypeId: 'drawing-canvas',
      config: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('rejects invalid config before writing activity instances', async () => {
    const capture: Capture = { inserts: [], calls: [] };
    createClientMock.mockResolvedValue(
      makeSupabase({ profiles: [teacherProfile()] }, capture),
    );

    const result = await assignActivity({
      activityTypeId: 'drawing-canvas',
      config: { mode: 'guided', prompt: '' },
      studentIds: [STUDENT_ONE],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Configurația');
    expect(capture.inserts).toHaveLength(0);
  });

  it('creates one activity instance per student in an owned class', async () => {
    const capture: Capture = { inserts: [], calls: [] };
    createClientMock.mockResolvedValue(
      makeSupabase(
        {
          profiles: [teacherProfile()],
          classes: [{ data: { id: CLASS_ID }, error: null }],
          students: [
            {
              data: [
                { id: STUDENT_ONE, class_id: CLASS_ID },
                { id: STUDENT_TWO, class_id: CLASS_ID },
              ],
              error: null,
            },
          ],
          activity_instances: [
            {
              data: [{ id: INSTANCE_ONE }, { id: INSTANCE_TWO }],
              error: null,
            },
          ],
        },
        capture,
      ),
    );

    const result = await assignActivity({
      activityTypeId: 'drawing-canvas',
      config: { mode: 'freeform' },
      classId: CLASS_ID,
    });

    expect(result).toEqual({
      success: true,
      data: { instanceIds: [INSTANCE_ONE, INSTANCE_TWO] },
    });
    expect(capture.inserts[0]).toMatchObject({
      table: 'activity_instances',
      payload: [
        {
          type_id: 'drawing-canvas',
          assigned_to: STUDENT_ONE,
          class_id: CLASS_ID,
          created_by: TEACHER_ID,
        },
        {
          type_id: 'drawing-canvas',
          assigned_to: STUDENT_TWO,
          class_id: CLASS_ID,
          created_by: TEACHER_ID,
        },
      ],
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/classes/22222222-2222-4222-8222-222222222222');
  });

  it('rejects direct student assignments outside the teacher roster', async () => {
    const capture: Capture = { inserts: [], calls: [] };
    createClientMock.mockResolvedValue(
      makeSupabase(
        {
          profiles: [teacherProfile()],
          students: [
            {
              data: [{ id: STUDENT_ONE, class_id: OTHER_CLASS_ID }],
              error: null,
            },
          ],
          classes: [{ data: [], error: null }],
        },
        capture,
      ),
    );

    const result = await assignActivity({
      activityTypeId: 'voice-recording',
      config: { promptText: 'Spune o poezie scurtă' },
      studentIds: [STUDENT_ONE],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Poți atribui activități doar elevilor din clasele tale.');
    expect(capture.inserts).toHaveLength(0);
  });
});
