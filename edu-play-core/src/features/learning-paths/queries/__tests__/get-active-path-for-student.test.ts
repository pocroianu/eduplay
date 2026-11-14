import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getActivePathForStudent } from '../get-active-path-for-student';

const STUDENT = '11111111-1111-4111-8111-111111111111';
const PATH = '22222222-2222-4222-8222-222222222222';
const STEP_A = '33333333-3333-4333-8333-333333333333';
const STEP_B = '44444444-4444-4444-8444-444444444444';
const CLASS = '99999999-9999-4999-8999-999999999999';

interface FakeQuery {
  data?: unknown;
  error?: { message: string } | null;
}

interface SupabaseScript {
  student: FakeQuery;
  assignments: FakeQuery;
  progress: FakeQuery;
  path: FakeQuery;
  steps: FakeQuery;
}

interface FilterCapture {
  assignmentsFilter?: string;
}

function fakeSupabase(
  script: SupabaseScript,
  capture: FilterCapture = {},
): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      if (table === 'students') {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.maybeSingle = vi.fn(() => Promise.resolve(script.student));
        return builder;
      }
      if (table === 'learning_path_assignments') {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.or = vi.fn((filter: string) => {
          capture.assignmentsFilter = filter;
          return builder;
        });
        builder.order = vi.fn(() => Promise.resolve(script.assignments));
        return builder;
      }
      if (table === 'student_path_progress') {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.in = vi.fn(() => Promise.resolve(script.progress));
        return builder;
      }
      if (table === 'learning_paths') {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.maybeSingle = vi.fn(() => Promise.resolve(script.path));
        return builder;
      }
      if (table === 'learning_path_steps') {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.order = vi.fn(() => Promise.resolve(script.steps));
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    }),
  } as unknown as SupabaseClient;
}

const PATH_ROW = {
  id: PATH,
  title: 'Aventura',
  description: null,
  age_min: null,
  age_max: null,
  status: 'published',
  owner_kind: 'teacher',
  created_by: 't1',
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getActivePathForStudent', () => {
  it('returns null for an invalid student id', async () => {
    const supabase = fakeSupabase({
      student: { data: null, error: null },
      assignments: { data: [], error: null },
      progress: { data: [], error: null },
      path: { data: null, error: null },
      steps: { data: [], error: null },
    });
    const result = await getActivePathForStudent(supabase, 'not-a-uuid');
    expect(result).toBeNull();
  });

  it('returns null when no assignments exist', async () => {
    const supabase = fakeSupabase({
      student: { data: { class_id: null }, error: null },
      assignments: { data: [], error: null },
      progress: { data: [], error: null },
      path: { data: null, error: null },
      steps: { data: [], error: null },
    });
    const result = await getActivePathForStudent(supabase, STUDENT);
    expect(result).toBeNull();
  });

  it('scopes class assignments to the student’s own class_id', async () => {
    const capture: FilterCapture = {};
    const supabase = fakeSupabase(
      {
        student: { data: { class_id: CLASS }, error: null },
        assignments: {
          data: [{ path_id: PATH, created_at: '2026-05-01T00:00:00Z' }],
          error: null,
        },
        progress: { data: [], error: null },
        path: { data: PATH_ROW, error: null },
        steps: {
          data: [
            {
              id: STEP_A,
              path_id: PATH,
              step_order: 0,
              kind: 'activity_template',
              target_activity_type: 'drawing-canvas',
              target_activity_config: {},
              title: 'Pasul 1',
              description: null,
              created_at: '2026-05-01T00:00:00Z',
            },
          ],
          error: null,
        },
      },
      capture,
    );

    await getActivePathForStudent(supabase, STUDENT);
    expect(capture.assignmentsFilter).toContain(`student_id.eq.${STUDENT}`);
    expect(capture.assignmentsFilter).toContain(`class_id.in.(${CLASS})`);
    expect(capture.assignmentsFilter).not.toContain('class_id.not.is.null');
  });

  it('omits the class branch when the student has no class', async () => {
    const capture: FilterCapture = {};
    const supabase = fakeSupabase(
      {
        student: { data: { class_id: null }, error: null },
        assignments: {
          data: [{ path_id: PATH, created_at: '2026-05-01T00:00:00Z' }],
          error: null,
        },
        progress: { data: [], error: null },
        path: { data: PATH_ROW, error: null },
        steps: { data: [], error: null },
      },
      capture,
    );
    await getActivePathForStudent(supabase, STUDENT);
    expect(capture.assignmentsFilter).toBe(`student_id.eq.${STUDENT}`);
  });

  it('marks the first step current for a not_started path', async () => {
    const supabase = fakeSupabase({
      student: { data: { class_id: null }, error: null },
      assignments: {
        data: [{ path_id: PATH, created_at: '2026-05-01T00:00:00Z' }],
        error: null,
      },
      progress: { data: [], error: null },
      path: { data: PATH_ROW, error: null },
      steps: {
        data: [
          {
            id: STEP_A,
            path_id: PATH,
            step_order: 0,
            kind: 'activity_template',
            target_activity_type: 'drawing-canvas',
            target_activity_config: {},
            title: 'Pasul 1',
            description: null,
            created_at: '2026-05-01T00:00:00Z',
          },
          {
            id: STEP_B,
            path_id: PATH,
            step_order: 1,
            kind: 'activity_template',
            target_activity_type: 'drawing-canvas',
            target_activity_config: {},
            title: 'Pasul 2',
            description: null,
            created_at: '2026-05-01T00:00:00Z',
          },
        ],
        error: null,
      },
    });

    const result = await getActivePathForStudent(supabase, STUDENT);
    expect(result?.steps[0]?.studentStatus).toBe('current');
    expect(result?.steps[1]?.studentStatus).toBe('locked');
    expect(result?.progress).toBeNull();
  });

  it('skips paths whose progress is completed', async () => {
    const SECOND_PATH = '55555555-5555-4555-8555-555555555555';
    const supabase = fakeSupabase({
      student: { data: { class_id: null }, error: null },
      assignments: {
        data: [
          { path_id: SECOND_PATH, created_at: '2026-05-02T00:00:00Z' },
          { path_id: PATH, created_at: '2026-05-01T00:00:00Z' },
        ],
        error: null,
      },
      progress: {
        data: [
          {
            id: 'pr1',
            student_id: STUDENT,
            path_id: SECOND_PATH,
            current_step_id: null,
            last_completed_step_id: null,
            status: 'completed',
            started_at: '2026-05-02T00:00:00Z',
            completed_at: '2026-05-02T01:00:00Z',
            updated_at: '2026-05-02T01:00:00Z',
          },
        ],
        error: null,
      },
      path: { data: PATH_ROW, error: null },
      steps: { data: [], error: null },
    });

    const result = await getActivePathForStudent(supabase, STUDENT);
    expect(result?.path.id).toBe(PATH);
  });
});
