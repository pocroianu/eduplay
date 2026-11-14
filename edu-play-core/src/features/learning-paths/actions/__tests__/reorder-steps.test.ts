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

import { reorderSteps } from '../reorder-steps';

const PATH_ID = '11111111-1111-4111-8111-111111111111';
const STEP_A = '22222222-2222-4222-8222-222222222222';
const STEP_B = '33333333-3333-4333-8333-333333333333';
const STEP_C = '44444444-4444-4444-8444-444444444444';
const ACTOR_ID = '55555555-5555-4555-8555-555555555555';

interface FakeResult {
  data?: unknown;
  error?: { message: string } | null;
}

interface RpcCapture {
  name?: string;
  args?: Record<string, unknown>;
}

function fakeReorderSupabase(result: FakeResult, capture: RpcCapture = {}) {
  return {
    rpc: vi.fn((name: string, args: Record<string, unknown>) => {
      capture.name = name;
      capture.args = args;
      return Promise.resolve(result);
    }),
  };
}

function mockTeacher(supabase: unknown) {
  requireRoleMock.mockResolvedValueOnce({
    user: { id: ACTOR_ID, email: 't@example.com' },
    profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
    supabase,
  });
}

beforeEach(() => {
  requireRoleMock.mockReset();
  revalidatePathMock.mockReset();
});

describe('reorderSteps', () => {
  it('rejects malformed path and step ids before auth', async () => {
    const badPath = await reorderSteps({
      pathId: 'nope',
      orderedStepIds: [STEP_A],
    });
    const badStep = await reorderSteps({
      pathId: PATH_ID,
      orderedStepIds: ['nope'],
    });

    expect(badPath.success).toBe(false);
    expect(badStep.success).toBe(false);
    expect(requireRoleMock).not.toHaveBeenCalled();
  });

  it('maps the RPC non-draft rejection to the addStep immutability copy', async () => {
    const supabase = fakeReorderSupabase({
      data: null,
      error: { message: 'learning_path_not_draft' },
    });
    mockTeacher(supabase);

    const result = await reorderSteps({
      pathId: PATH_ID,
      orderedStepIds: [STEP_B, STEP_A],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Nu poți reordona pașii unui parcurs publicat sau arhivat',
    );
  });

  it('maps the RPC exact step-set rejection to the mismatch copy', async () => {
    const supabase = fakeReorderSupabase({
      data: null,
      error: { message: 'learning_path_step_mismatch' },
    });
    mockTeacher(supabase);

    const result = await reorderSteps({
      pathId: PATH_ID,
      orderedStepIds: [STEP_A, STEP_C],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Lista de pași nu se potrivește cu parcursul');
  });

  it('persists the reordered ids through the atomic RPC', async () => {
    const capture: RpcCapture = {};
    const supabase = fakeReorderSupabase(
      {
        data: [
          { id: STEP_C, step_order: 0 },
          { id: STEP_A, step_order: 1 },
          { id: STEP_B, step_order: 2 },
        ],
        error: null,
      },
      capture,
    );
    mockTeacher(supabase);

    const result = await reorderSteps({
      pathId: PATH_ID,
      orderedStepIds: [STEP_C, STEP_A, STEP_B],
    });

    expect(result.success).toBe(true);
    expect(capture).toEqual({
      name: 'reorder_learning_path_steps',
      args: {
        p_path_id: PATH_ID,
        p_ordered_step_ids: [STEP_C, STEP_A, STEP_B],
      },
    });
    expect(result.data?.orderedStepIds).toEqual([STEP_C, STEP_A, STEP_B]);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/teacher/paths/${PATH_ID}`);
  });
});
