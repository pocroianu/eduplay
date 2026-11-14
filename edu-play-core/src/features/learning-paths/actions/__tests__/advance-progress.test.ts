import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}));

import { advanceProgress } from '../advance-progress';
import type { EduplaySupabaseClient } from '../advance-progress';

const STUDENT = '11111111-1111-4111-8111-111111111111';
const PATH = '22222222-2222-4222-8222-222222222222';
const STEP_1 = '33333333-3333-4333-8333-333333333331';
const STEP_2 = '33333333-3333-4333-8333-333333333332';
const STEP_3 = '33333333-3333-4333-8333-333333333333';
const PROGRESS = '44444444-4444-4444-8444-444444444444';

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.createAdminClient.mockReset();
});

describe('advanceProgress', () => {
  it('throws a Romanian validation error for invalid input', async () => {
    await expect(
      advanceProgress({ studentId: 'nope', pathId: PATH, completedStepId: STEP_1 }),
    ).rejects.toThrow(/elev/);
  });

  it('moves a not-started path to the next step after the first completion', async () => {
    const { client, adminClient, captures } = makeAdvanceClient({
      completedStep: step(STEP_1, 1),
      nextStep: step(STEP_2, 2),
      previousStep: null,
      existingProgress: null,
    });
    mocks.createClient.mockResolvedValue(asSupabaseClient(client));
    mocks.createAdminClient.mockReturnValue(asSupabaseClient(adminClient));

    await advanceProgress({
      studentId: STUDENT,
      pathId: PATH,
      completedStepId: STEP_1,
    });

    expect(captures.userUpsertPayload).toBeUndefined();
    expect(captures.adminUpsertPayload).toMatchObject({
      student_id: STUDENT,
      path_id: PATH,
      current_step_id: STEP_2,
      last_completed_step_id: STEP_1,
      status: 'in_progress',
      completed_at: null,
    });
    expect(captures.adminUpsertOptions).toEqual({ onConflict: 'student_id,path_id' });
    expect(captures.adminUpsertPayload?.started_at).toEqual(expect.any(String));
  });

  it('advances an in-progress path from the current step to the following step', async () => {
    const { client, adminClient, captures } = makeAdvanceClient({
      completedStep: step(STEP_2, 2),
      nextStep: step(STEP_3, 3),
      previousStep: step(STEP_1, 1),
      existingProgress: progress({
        current_step_id: STEP_2,
        last_completed_step_id: STEP_1,
        status: 'in_progress',
        started_at: '2026-05-14T10:00:00.000Z',
      }),
    });
    mocks.createClient.mockResolvedValue(asSupabaseClient(client));
    mocks.createAdminClient.mockReturnValue(asSupabaseClient(adminClient));

    await advanceProgress({
      studentId: STUDENT,
      pathId: PATH,
      completedStepId: STEP_2,
    });

    expect(captures.adminUpsertPayload).toMatchObject({
      current_step_id: STEP_3,
      last_completed_step_id: STEP_2,
      status: 'in_progress',
      started_at: '2026-05-14T10:00:00.000Z',
      completed_at: null,
    });
  });

  it('marks the path completed when the final step completes', async () => {
    const { client, adminClient, captures } = makeAdvanceClient({
      completedStep: step(STEP_3, 3),
      nextStep: null,
      previousStep: step(STEP_2, 2),
      existingProgress: progress({
        current_step_id: STEP_3,
        last_completed_step_id: STEP_2,
        status: 'in_progress',
        started_at: '2026-05-14T10:00:00.000Z',
      }),
    });
    mocks.createClient.mockResolvedValue(asSupabaseClient(client));
    mocks.createAdminClient.mockReturnValue(asSupabaseClient(adminClient));

    await advanceProgress({
      studentId: STUDENT,
      pathId: PATH,
      completedStepId: STEP_3,
    });

    expect(captures.adminUpsertPayload).toMatchObject({
      current_step_id: null,
      last_completed_step_id: STEP_3,
      status: 'completed',
      started_at: '2026-05-14T10:00:00.000Z',
    });
    expect(captures.adminUpsertPayload?.completed_at).toEqual(expect.any(String));
  });

  it('does not rewrite progress when the same completed step is reported twice', async () => {
    const { client, adminClient, captures } = makeAdvanceClient({
      completedStep: step(STEP_1, 1),
      nextStep: step(STEP_2, 2),
      previousStep: null,
      existingProgress: progress({
        current_step_id: STEP_2,
        last_completed_step_id: STEP_1,
        status: 'in_progress',
      }),
    });
    mocks.createClient.mockResolvedValue(asSupabaseClient(client));
    mocks.createAdminClient.mockReturnValue(asSupabaseClient(adminClient));

    await advanceProgress({
      studentId: STUDENT,
      pathId: PATH,
      completedStepId: STEP_1,
    });

    expect(captures.adminUpsertPayload).toBeUndefined();
    expect(captures.userUpsertPayload).toBeUndefined();
  });

  it('does not initialize a not-started path from a later locked step', async () => {
    const { client, adminClient, captures } = makeAdvanceClient({
      completedStep: step(STEP_2, 2),
      nextStep: step(STEP_3, 3),
      previousStep: step(STEP_1, 1),
      existingProgress: null,
    });
    mocks.createClient.mockResolvedValue(asSupabaseClient(client));
    mocks.createAdminClient.mockReturnValue(asSupabaseClient(adminClient));

    await advanceProgress({
      studentId: STUDENT,
      pathId: PATH,
      completedStepId: STEP_2,
    });

    expect(captures.adminUpsertPayload).toBeUndefined();
    expect(captures.userUpsertPayload).toBeUndefined();
  });
});

interface FakeStep {
  id: string;
  path_id: string;
  step_order: number;
}

interface FakeProgress {
  id: string;
  student_id: string;
  path_id: string;
  current_step_id: string | null;
  last_completed_step_id: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

interface AdvanceFixtures {
  completedStep: FakeStep | null;
  nextStep: FakeStep | null;
  previousStep: FakeStep | null;
  existingProgress: FakeProgress | null;
}

interface CaptureState {
  adminUpsertPayload?: Record<string, unknown>;
  adminUpsertOptions?: Record<string, unknown>;
  userUpsertPayload?: Record<string, unknown>;
  userUpsertOptions?: Record<string, unknown>;
}

function step(id: string, order: number): FakeStep {
  return { id, path_id: PATH, step_order: order };
}

function progress(overrides: Partial<FakeProgress>): FakeProgress {
  return {
    id: PROGRESS,
    student_id: STUDENT,
    path_id: PATH,
    current_step_id: null,
    last_completed_step_id: null,
    status: 'not_started',
    started_at: null,
    completed_at: null,
    ...overrides,
  };
}

function makeAdvanceClient(fixtures: AdvanceFixtures) {
  const captures: CaptureState = {};
  const stepResults = [fixtures.completedStep, fixtures.nextStep, fixtures.previousStep];
  const progressResults = [fixtures.existingProgress, null];

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'learning_path_steps') {
        return makeQueryBuilder(() => stepResults.shift() ?? null);
      }

      if (table === 'student_path_progress') {
        // This test fake implements only the query-builder methods exercised by
        // runAdvanceProgress; add the upsert method below for that branch.
        const builder = makeQueryBuilder(() => progressResults.shift() ?? null) as ReturnType<
          typeof makeQueryBuilder
        > & {
          upsert: ReturnType<typeof vi.fn>;
        };
        builder.upsert = vi.fn((payload: Record<string, unknown>, options: Record<string, unknown>) => {
          captures.userUpsertPayload = payload;
          captures.userUpsertOptions = options;
          return builder;
        });
        return builder;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  const adminClient = {
    from: vi.fn((table: string) => {
      if (table !== 'student_path_progress') {
        throw new Error(`Unexpected admin table: ${table}`);
      }
      // This test fake implements only the admin upsert chain exercised by
      // runAdvanceProgress after it validates reads through the user client.
      const builder = makeQueryBuilder(() => ({ id: PROGRESS })) as ReturnType<
        typeof makeQueryBuilder
      > & {
        upsert: ReturnType<typeof vi.fn>;
      };
      builder.upsert = vi.fn((payload: Record<string, unknown>, options: Record<string, unknown>) => {
        captures.adminUpsertPayload = payload;
        captures.adminUpsertOptions = options;
        return builder;
      });
      return builder;
    }),
  };

  return { client, adminClient, captures };
}

function makeQueryBuilder(resolveData: () => unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ data: resolveData(), error: null })),
  };
  return builder;
}

function asSupabaseClient(client: unknown): EduplaySupabaseClient {
  // The fake implements the `from()` chains exercised by advanceProgress.
  return client as EduplaySupabaseClient;
}
