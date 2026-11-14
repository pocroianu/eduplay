import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAssignmentsForPath } from '../get-assignments-for-path';

const PATH_ID = '11111111-1111-4111-8111-111111111111';

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

interface Capture {
  filters: Array<[column: string, value: unknown]>;
  order?: [column: string, options?: unknown];
}

function fakeSupabase(result: FakeResult, capture: Capture) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((column: string, value: unknown) => {
    capture.filters.push([column, value]);
    return builder;
  });
  builder.order = vi.fn((column: string, options?: unknown) => {
    capture.order = [column, options];
    return Promise.resolve(result);
  });

  return {
    from: vi.fn(() => builder),
  } as unknown as SupabaseClient;
}

describe('getAssignmentsForPath', () => {
  it('returns class and student assignment targets for the requested path', async () => {
    const capture: Capture = { filters: [] };
    const supabase = fakeSupabase(
      {
        data: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            path_id: PATH_ID,
            class_id: '33333333-3333-4333-8333-333333333333',
            student_id: null,
            assigned_by: '44444444-4444-4444-8444-444444444444',
            due_date: '2026-06-01',
            created_at: '2026-05-01T00:00:00Z',
            class: { id: '33333333-3333-4333-8333-333333333333', name: 'Clasa Fluturașilor' },
            student: null,
          },
          {
            id: '55555555-5555-4555-8555-555555555555',
            path_id: PATH_ID,
            class_id: null,
            student_id: '66666666-6666-4666-8666-666666666666',
            assigned_by: '44444444-4444-4444-8444-444444444444',
            due_date: null,
            created_at: '2026-05-02T00:00:00Z',
            class: null,
            student: {
              id: '66666666-6666-4666-8666-666666666666',
              username: 'ana',
              profile: { full_name: 'Ana Pop' },
            },
          },
        ],
        error: null,
      },
      capture,
    );

    const assignments = await getAssignmentsForPath(supabase, PATH_ID);

    expect(assignments).toMatchObject([
      {
        id: '22222222-2222-4222-8222-222222222222',
        targetType: 'class',
        targetName: 'Clasa Fluturașilor',
        dueDate: '2026-06-01',
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        targetType: 'student',
        targetName: 'Ana Pop',
        targetDetail: 'ana',
      },
    ]);
    expect(capture.filters).toContainEqual(['path_id', PATH_ID]);
    expect(capture.order).toEqual(['created_at', { ascending: false }]);
  });

  it('returns an empty array for malformed path ids without querying', async () => {
    const capture: Capture = { filters: [] };
    const supabase = fakeSupabase({ data: [], error: null }, capture);

    await expect(getAssignmentsForPath(supabase, 'bad')).resolves.toEqual([]);
    expect(capture.filters).toEqual([]);
  });
});
