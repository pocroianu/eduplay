import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const createAdminClientMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => createAdminClientMock(),
}));

import { getClassPathProgress } from '../get-class-path-progress';

const PATH = '11111111-1111-4111-8111-111111111111';
const CLASS = '22222222-2222-4222-8222-222222222222';
const STUDENT_A = '33333333-3333-4333-8333-333333333333';
const STUDENT_B = '44444444-4444-4444-8444-444444444444';

interface FakeQuery {
  data?: unknown;
  error?: { message: string } | null;
}

interface SupabaseScript {
  path: FakeQuery;
  students: FakeQuery;
  assignment: FakeQuery;
  progress: FakeQuery;
  steps?: FakeQuery;
}

function fakeSupabase(script: SupabaseScript): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      if (table === 'learning_paths') {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.maybeSingle = vi.fn(() => Promise.resolve(script.path));
        return builder;
      }
      if (table === 'students') {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.order = vi.fn(() => Promise.resolve(script.students));
        return builder;
      }
      if (table === 'learning_path_assignments') {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.limit = vi.fn(() => Promise.resolve(script.assignment));
        return builder;
      }
      if (table === 'student_path_progress') {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.in = vi.fn(() => Promise.resolve(script.progress));
        return builder;
      }
      if (table === 'learning_path_steps') {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.order = vi.fn(() =>
          Promise.resolve(script.steps ?? { data: [], error: null }),
        );
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

describe('getClassPathProgress', () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
  });

  it('returns not_found for non-uuid inputs', async () => {
    const supabase = fakeSupabase({
      path: { data: null, error: null },
      students: { data: [], error: null },
      assignment: { data: [], error: null },
      progress: { data: [], error: null },
      steps: { data: [], error: null },
    });
    expect(await getClassPathProgress(supabase, 'nope', CLASS)).toMatchObject({
      ok: false,
      reason: 'not_found',
    });
    expect(await getClassPathProgress(supabase, PATH, 'nope')).toMatchObject({
      ok: false,
      reason: 'not_found',
    });
  });

  it('returns not_found when the path is invisible', async () => {
    const supabase = fakeSupabase({
      path: { data: null, error: null },
      students: { data: [], error: null },
      assignment: { data: [], error: null },
      progress: { data: [], error: null },
      steps: { data: [], error: null },
    });
    expect(await getClassPathProgress(supabase, PATH, CLASS)).toMatchObject({
      ok: false,
      reason: 'not_found',
    });
  });

  it('returns not_assigned when the path has no assignment for this class', async () => {
    const supabase = fakeSupabase({
      path: { data: PATH_ROW, error: null },
      students: { data: [], error: null },
      assignment: { data: [], error: null },
      progress: { data: [], error: null },
      steps: { data: [], error: null },
    });
    expect(await getClassPathProgress(supabase, PATH, CLASS)).toMatchObject({
      ok: false,
      reason: 'not_assigned',
    });
  });

  it('renders rows with progress merged by student', async () => {
    const supabase = fakeSupabase({
      path: { data: PATH_ROW, error: null },
      students: {
        data: [
          { id: STUDENT_A, username: 'alex' },
          { id: STUDENT_B, username: 'bianca' },
        ],
        error: null,
      },
      assignment: { data: [{ id: 'a1' }], error: null },
      progress: {
        data: [
          {
            id: 'pr1',
            student_id: STUDENT_A,
            path_id: PATH,
            current_step_id: null,
            last_completed_step_id: null,
            status: 'in_progress',
            started_at: '2026-05-01T00:00:00Z',
            completed_at: null,
            updated_at: '2026-05-01T00:00:00Z',
          },
        ],
        error: null,
      },
      steps: {
        data: [
          {
            id: 'step-1',
            path_id: PATH,
            step_order: 0,
            kind: 'activity_template',
            target_activity_type: 'drawing-canvas',
            target_activity_config: null,
            title: 'Primul pas',
            description: null,
            created_at: '2026-05-01T00:00:00Z',
          },
          {
            id: 'step-2',
            path_id: PATH,
            step_order: 1,
            kind: 'activity_template',
            target_activity_type: 'drawing-canvas',
            target_activity_config: null,
            title: 'Al doilea pas',
            description: null,
            created_at: '2026-05-01T00:00:00Z',
          },
        ],
        error: null,
      },
    });
    createAdminClientMock.mockReturnValueOnce(supabase);

    const result = await getClassPathProgress(supabase, PATH, CLASS);
    if (!result.ok) throw new Error('expected ok result');
    expect(result.rows).toHaveLength(2);
    expect(result.steps.map((step) => step.title)).toEqual([
      'Primul pas',
      'Al doilea pas',
    ]);
    expect(result.rows[0]?.progress?.status).toBe('in_progress');
    expect(result.rows[1]?.progress).toBeNull();
  });

  it('includes student full names when profile data is available', async () => {
    const supabase = fakeSupabase({
      path: { data: PATH_ROW, error: null },
      students: {
        data: [
          {
            id: STUDENT_A,
            username: 'alex',
            profile: { full_name: 'Alex Ionescu' },
          },
        ],
        error: null,
      },
      assignment: { data: [{ id: 'a1' }], error: null },
      progress: { data: [], error: null },
      steps: { data: [], error: null },
    });
    createAdminClientMock.mockReturnValueOnce(supabase);

    const result = await getClassPathProgress(supabase, PATH, CLASS);

    if (!result.ok) throw new Error('expected ok result');
    expect(result.rows[0]?.student).toMatchObject({
      username: 'alex',
      fullName: 'Alex Ionescu',
    });
  });

  it('returns an empty rows list when the assigned class has no students', async () => {
    const supabase = fakeSupabase({
      path: { data: PATH_ROW, error: null },
      students: { data: [], error: null },
      assignment: { data: [{ id: 'a1' }], error: null },
      progress: { data: [], error: null },
      steps: { data: [], error: null },
    });
    createAdminClientMock.mockReturnValueOnce(supabase);

    const result = await getClassPathProgress(supabase, PATH, CLASS);
    if (!result.ok) throw new Error('expected ok result');
    expect(result.rows).toEqual([]);
  });

  it('uses an admin-visible roster lookup after the path assignment is visible', async () => {
    const userSupabase = fakeSupabase({
      path: { data: PATH_ROW, error: null },
      students: { data: [], error: null },
      assignment: { data: [{ id: 'a1' }], error: null },
      progress: { data: [], error: null },
      steps: { data: [], error: null },
    });
    const adminSupabase = fakeSupabase({
      path: { data: PATH_ROW, error: null },
      students: {
        data: [
          { id: STUDENT_A, username: 'alex' },
          { id: STUDENT_B, username: 'bianca' },
        ],
        error: null,
      },
      assignment: { data: [{ id: 'a1' }], error: null },
      progress: { data: [], error: null },
      steps: { data: [], error: null },
    });
    createAdminClientMock.mockReturnValueOnce(adminSupabase);

    const result = await getClassPathProgress(userSupabase, PATH, CLASS);

    if (!result.ok) throw new Error('expected ok result');
    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
    expect(result.rows.map((row) => row.student.username)).toEqual([
      'alex',
      'bianca',
    ]);
  });
});
