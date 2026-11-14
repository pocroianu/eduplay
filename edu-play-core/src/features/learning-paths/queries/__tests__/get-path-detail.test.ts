import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPathById, getStepsForPath } from '../get-path-detail';

const TEACHER = '11111111-1111-4111-8111-111111111111';
const PATH_ID = '22222222-2222-4222-8222-222222222222';

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

interface Capture {
  filters: Array<[column: string, value: unknown]>;
  orFilter?: string;
  order?: [column: string, options?: unknown];
}

function makeBuilder(result: FakeResult, capture: Capture) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((column: string, value: unknown) => {
    capture.filters.push([column, value]);
    return builder;
  });
  builder.or = vi.fn((filter: string) => {
    capture.orFilter = filter;
    return builder;
  });
  builder.order = vi.fn((column: string, options?: unknown) => {
    capture.order = [column, options];
    return Promise.resolve(result);
  });
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  return builder;
}

function fakeSupabase(result: FakeResult, capture: Capture) {
  const builder = makeBuilder(result, capture);
  return {
    from: vi.fn(() => builder),
  } as unknown as SupabaseClient;
}

describe('getPathById', () => {
  it('returns null for malformed path or teacher ids', async () => {
    const capture: Capture = { filters: [] };
    const supabase = fakeSupabase({ data: null, error: null }, capture);
    await expect(getPathById(supabase, 'bad', PATH_ID)).resolves.toBeNull();
    await expect(getPathById(supabase, TEACHER, 'bad')).resolves.toBeNull();
    expect(capture.filters).toEqual([]);
  });

  it('scopes detail reads to the requested path and teacher-owned or admin-published paths', async () => {
    const capture: Capture = { filters: [] };
    const supabase = fakeSupabase(
      {
        data: {
          id: PATH_ID,
          title: 'Parcurs de test',
          description: null,
          age_min: 6,
          age_max: 8,
          status: 'draft',
          owner_kind: 'teacher',
          created_by: TEACHER,
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-02T00:00:00Z',
        },
        error: null,
      },
      capture,
    );

    const path = await getPathById(supabase, TEACHER, PATH_ID);

    expect(path?.title).toBe('Parcurs de test');
    expect(capture.filters).toContainEqual(['id', PATH_ID]);
    expect(capture.orFilter).toContain(`created_by.eq.${TEACHER}`);
    expect(capture.orFilter).toContain('owner_kind.eq.admin');
    expect(capture.orFilter).toContain('status.eq.published');
  });

  it('throws when the detail query errors', async () => {
    const supabase = fakeSupabase(
      { data: null, error: { message: 'boom' } },
      { filters: [] },
    );
    await expect(getPathById(supabase, TEACHER, PATH_ID)).rejects.toThrow(
      /boom/,
    );
  });
});

describe('getStepsForPath', () => {
  it('returns steps ordered by step_order', async () => {
    const capture: Capture = { filters: [] };
    const supabase = fakeSupabase(
      {
        data: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            path_id: PATH_ID,
            step_order: 0,
            kind: 'activity_template',
            target_activity_type: 'drawing-canvas',
            target_activity_config: {},
            title: 'Primul pas',
            description: null,
            created_at: '2026-05-01T00:00:00Z',
          },
        ],
        error: null,
      },
      capture,
    );

    const steps = await getStepsForPath(supabase, PATH_ID);

    expect(steps).toHaveLength(1);
    expect(steps[0]?.stepOrder).toBe(0);
    expect(capture.filters).toContainEqual(['path_id', PATH_ID]);
    expect(capture.order).toEqual(['step_order', { ascending: true }]);
  });

  it('returns an empty array for malformed path ids', async () => {
    const capture: Capture = { filters: [] };
    const supabase = fakeSupabase({ data: [], error: null }, capture);
    await expect(getStepsForPath(supabase, 'bad')).resolves.toEqual([]);
    expect(capture.filters).toEqual([]);
  });
});
