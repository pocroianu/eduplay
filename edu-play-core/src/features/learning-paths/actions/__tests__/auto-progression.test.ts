import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runAdvanceProgress: vi.fn(),
}));

vi.mock('../advance-progress', () => ({
  runAdvanceProgress: mocks.runAdvanceProgress,
}));

import {
  advanceActivityCompletionProgress,
} from '../auto-progression';
import type { EduplaySupabaseClient } from '../advance-progress';

const STUDENT = '11111111-1111-4111-8111-111111111111';
const CLASS = '22222222-2222-4222-8222-222222222222';
const PATH = '33333333-3333-4333-8333-333333333333';
const STEP = '55555555-5555-4555-8555-555555555555';
const OTHER_STEP = '66666666-6666-4666-8666-666666666666';
const ACTIVITY_INSTANCE = '77777777-7777-4777-8777-777777777777';

beforeEach(() => {
  mocks.runAdvanceProgress.mockReset();
  mocks.runAdvanceProgress.mockResolvedValue(undefined);
});

describe('auto-progression completion hooks', () => {
  it('advances only assigned activity-template steps whose type and config match the completed instance', async () => {
    const matchingConfig = { prompt: 'Desenează soarele', colors: ['red', 'gold'] };
    const client = makeQueuedClient([
      {
        data: {
          id: ACTIVITY_INSTANCE,
          assigned_to: STUDENT,
          type_id: 'drawing-canvas',
          config: matchingConfig,
          result_summary: { status: 'completed' },
        },
        error: null,
      },
      { data: { class_id: CLASS }, error: null },
      { data: [{ path_id: PATH }], error: null },
      {
        data: [
          {
            id: STEP,
            path_id: PATH,
            target_activity_config: { colors: ['red', 'gold'], prompt: 'Desenează soarele' },
          },
          {
            id: OTHER_STEP,
            path_id: PATH,
            target_activity_config: { prompt: 'Altceva' },
          },
        ],
        error: null,
      },
    ]);

    await advanceActivityCompletionProgress(asSupabaseClient(client), {
      activityInstanceId: ACTIVITY_INSTANCE,
    });

    expect(mocks.runAdvanceProgress).toHaveBeenCalledTimes(1);
    expect(mocks.runAdvanceProgress).toHaveBeenCalledWith(client, {
      studentId: STUDENT,
      pathId: PATH,
      completedStepId: STEP,
    });
  });

  it('ignores activity instances whose result summary is not completed', async () => {
    const client = makeQueuedClient([
      {
        data: {
          id: ACTIVITY_INSTANCE,
          assigned_to: STUDENT,
          type_id: 'drawing-canvas',
          config: {},
          result_summary: { status: 'draft' },
        },
        error: null,
      },
    ]);

    await advanceActivityCompletionProgress(asSupabaseClient(client), {
      activityInstanceId: ACTIVITY_INSTANCE,
    });

    expect(mocks.runAdvanceProgress).not.toHaveBeenCalled();
  });
});

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

function makeQueuedClient(results: FakeResult[]) {
  const queue = [...results];
  const client = {
    from: vi.fn(() => makeBuilder(queue)),
  };
  return client;
}

function makeBuilder(results: FakeResult[]) {
  const builder: Record<string, unknown> = {};
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    in: vi.fn(() => api),
    is: vi.fn(() => api),
    or: vi.fn(() => api),
    maybeSingle: vi.fn(() => Promise.resolve(results.shift())),
    then: (
      resolve: (value: FakeResult | undefined) => unknown,
      reject: (reason?: unknown) => unknown,
    ) =>
      Promise.resolve(results.shift()).then(resolve, reject),
  };
  Object.assign(builder, api);
  return api;
}

function asSupabaseClient(client: unknown): EduplaySupabaseClient {
  // The fake implements the `from()` chains exercised by the hook under test.
  return client as EduplaySupabaseClient;
}
