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

import { addStep } from '../add-step';

const PATH_ID = '11111111-1111-4111-8111-111111111111';
const STEP_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR_ID = '44444444-4444-8444-8444-444444444444';
const ACTIVITY_TYPE_ID = 'drawing-canvas';

const STEP_ROW = {
  id: STEP_ID,
  path_id: PATH_ID,
  step_order: 0,
  kind: 'activity_template',
  target_activity_type: ACTIVITY_TYPE_ID,
  target_activity_config: {},
  title: 'Pasul 1',
  description: null,
  created_at: '2026-05-01T00:00:00Z',
};

interface InsertCapture {
  table?: string;
  payload?: Record<string, unknown>;
}

interface FakeQuery {
  data?: unknown;
  error?: { message: string } | null;
}

function fakeAddStepSupabase(
  pathRes: FakeQuery,
  insertRes: FakeQuery,
  capture: InsertCapture = {},
  activityTypeRes: FakeQuery = { data: { type_id: ACTIVITY_TYPE_ID }, error: null },
) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'learning_paths') {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.maybeSingle = vi.fn(() => Promise.resolve(pathRes));
        return builder;
      }
      if (table === 'activity_types') {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.maybeSingle = vi.fn(() => Promise.resolve(activityTypeRes));
        return builder;
      }
      if (table === 'learning_path_steps') {
        const builder: Record<string, unknown> = {};
        builder.insert = vi.fn((payload: Record<string, unknown>) => {
          capture.table = table;
          capture.payload = payload;
          return builder;
        });
        builder.select = vi.fn(() => builder);
        builder.maybeSingle = vi.fn(() => Promise.resolve(insertRes));
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    pathId: PATH_ID,
    stepOrder: 0,
    kind: 'activity_template',
    title: 'Pasul 1',
    targetActivityType: ACTIVITY_TYPE_ID,
    targetActivityConfig: {},
    ...overrides,
  };
}

beforeEach(() => {
  requireRoleMock.mockReset();
  revalidatePathMock.mockReset();
});

describe('addStep', () => {
  it('rejects a payload without an Activity type', async () => {
    const result = await addStep({
      pathId: PATH_ID,
      stepOrder: 0,
      kind: 'activity_template',
      title: 'Pasul 1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when the parent path is published', async () => {
    const supabase = fakeAddStepSupabase(
      { data: { status: 'published' }, error: null },
      { data: null, error: null },
    );
    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: 't@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
      supabase,
    });

    const result = await addStep(validInput());

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Nu poți adăuga pași la un parcurs publicat sau arhivat',
    );
  });

  it('rejects when the parent path is archived', async () => {
    const supabase = fakeAddStepSupabase(
      { data: { status: 'archived' }, error: null },
      { data: null, error: null },
    );
    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: 't@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
      supabase,
    });

    const result = await addStep(validInput());

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Nu poți adăuga pași la un parcurs publicat sau arhivat',
    );
  });

  it('returns not found when the parent path lookup misses', async () => {
    const supabase = fakeAddStepSupabase(
      { data: null, error: null },
      { data: null, error: null },
    );
    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: 't@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
      supabase,
    });

    const result = await addStep(validInput());

    expect(result.success).toBe(false);
    expect(result.error).toBe('Parcursul nu există');
  });

  it('inserts the Activity step row when the parent path is draft', async () => {
    const capture: InsertCapture = {};
    const supabase = fakeAddStepSupabase(
      { data: { status: 'draft' }, error: null },
      { data: STEP_ROW, error: null },
      capture,
    );

    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: 't@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
      supabase,
    });

    const result = await addStep(validInput());

    expect(result.success).toBe(true);
    expect(capture.table).toBe('learning_path_steps');
    expect(capture.payload).toMatchObject({
      path_id: PATH_ID,
      step_order: 0,
      kind: 'activity_template',
      target_activity_type: ACTIVITY_TYPE_ID,
    });
    expect(capture.payload).not.toHaveProperty('target_game_id');
    expect(result.data?.step.kind).toBe('activity_template');
  });

  it('rejects activity steps that target an unknown activity type', async () => {
    const capture: InsertCapture = {};
    const supabase = fakeAddStepSupabase(
      { data: { status: 'draft' }, error: null },
      { data: STEP_ROW, error: null },
      capture,
      { data: null, error: null },
    );

    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: 't@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
      supabase,
    });

    const result = await addStep(validInput({ targetActivityType: 'missing-renderer' }));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Tipul de activitate ales nu există');
    expect(capture.payload).toBeUndefined();
  });

  it('returns a friendly DB error on RLS-negative inserts', async () => {
    const supabase = fakeAddStepSupabase(
      { data: { status: 'draft' }, error: null },
      { data: null, error: { message: 'denied' } },
    );

    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: 't@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
      supabase,
    });

    const result = await addStep(validInput());

    expect(result.success).toBe(false);
    expect(result.error).toBe('Nu am putut adăuga pasul. Încearcă din nou.');
  });

  it('persists targetActivityConfig when supplied', async () => {
    const capture: InsertCapture = {};
    const supabase = fakeAddStepSupabase(
      { data: { status: 'draft' }, error: null },
      {
        data: {
          ...STEP_ROW,
          target_activity_config: { mode: 'free' },
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

    const result = await addStep(validInput({
      stepOrder: 1,
      title: 'Desen',
      targetActivityConfig: { mode: 'free' },
    }));

    expect(result.success).toBe(true);
    expect(capture.payload?.target_activity_config).toEqual({ mode: 'free' });
  });
});
