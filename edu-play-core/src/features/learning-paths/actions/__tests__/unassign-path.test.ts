import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRoleMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    requireRole: (...args: unknown[]) => requireRoleMock(...args),
  };
});

import { unassignPath } from '../unassign-path';

const ASSIGNMENT_ID = '11111111-1111-4111-8111-111111111111';
const PATH_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';

interface DeleteCapture {
  table?: string;
  filters: Array<[column: string, value: unknown]>;
}

function fakeDeleteSupabase(
  result: { data: unknown; error: { message: string } | null },
  capture: DeleteCapture,
) {
  return {
    from: vi.fn((table: string) => {
      capture.table = table;
      const builder: Record<string, unknown> = {};
      builder.delete = vi.fn(() => builder);
      builder.eq = vi.fn((column: string, value: unknown) => {
        capture.filters.push([column, value]);
        return builder;
      });
      builder.select = vi.fn(() => builder);
      builder.maybeSingle = vi.fn(() => Promise.resolve(result));
      return builder;
    }),
  };
}

beforeEach(() => {
  requireRoleMock.mockReset();
  revalidatePathMock.mockReset();
});

describe('unassignPath', () => {
  it('deletes the assignment by id and revalidates the path detail surface', async () => {
    const capture: DeleteCapture = { filters: [] };
    const supabase = fakeDeleteSupabase(
      {
        data: {
          id: ASSIGNMENT_ID,
          path_id: PATH_ID,
          class_id: null,
          student_id: '44444444-4444-4444-8444-444444444444',
        },
        error: null,
      },
      capture,
    );
    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: 't@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
      supabase,
    });

    const result = await unassignPath(ASSIGNMENT_ID);

    expect(result).toEqual({ success: true, data: { id: ASSIGNMENT_ID } });
    expect(capture.table).toBe('learning_path_assignments');
    expect(capture.filters).toContainEqual(['id', ASSIGNMENT_ID]);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/teacher/paths/${PATH_ID}`);
  });

  it('rejects malformed assignment ids before deleting', async () => {
    const result = await unassignPath('bad');
    expect(result.success).toBe(false);
    expect(requireRoleMock).not.toHaveBeenCalled();
  });
});
