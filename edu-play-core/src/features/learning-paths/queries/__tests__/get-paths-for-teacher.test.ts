import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPathsForTeacher } from '../get-paths-for-teacher';

const TEACHER = '11111111-1111-4111-8111-111111111111';

interface FakeSelectResult {
  data: unknown;
  error: { message: string } | null;
}

interface FilterCapture {
  filter?: string;
}

function fakeSupabase(result: FakeSelectResult, capture: FilterCapture = {}) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.or = vi.fn((filter: string) => {
    capture.filter = filter;
    return builder;
  });
  builder.order = vi.fn(() => Promise.resolve(result));
  return {
    from: vi.fn(() => builder),
  } as unknown as SupabaseClient;
}

describe('getPathsForTeacher', () => {
  it('returns an empty array for a malformed teacher id', async () => {
    const supabase = fakeSupabase({ data: [], error: null });
    expect(await getPathsForTeacher(supabase, 'nope')).toEqual([]);
  });

  it('scopes the query to created_by OR admin-published paths', async () => {
    const capture: FilterCapture = {};
    const supabase = fakeSupabase(
      {
        data: [
          {
            id: 'p1',
            title: 'Aventura',
            description: null,
            age_min: null,
            age_max: null,
            status: 'draft',
            owner_kind: 'teacher',
            created_by: TEACHER,
            created_at: '2026-05-01T00:00:00Z',
            updated_at: '2026-05-01T00:00:00Z',
          },
        ],
        error: null,
      },
      capture,
    );
    const paths = await getPathsForTeacher(supabase, TEACHER);
    expect(paths).toHaveLength(1);
    expect(paths[0]?.ownerKind).toBe('teacher');
    expect(capture.filter).toContain(`created_by.eq.${TEACHER}`);
    expect(capture.filter).toContain('owner_kind.eq.admin');
    expect(capture.filter).toContain('status.eq.published');
  });

  it('returns an empty array when no rows are returned', async () => {
    const supabase = fakeSupabase({ data: null, error: null });
    expect(await getPathsForTeacher(supabase, TEACHER)).toEqual([]);
  });

  it('throws when the underlying query errors out', async () => {
    const supabase = fakeSupabase({ data: null, error: { message: 'boom' } });
    await expect(getPathsForTeacher(supabase, TEACHER)).rejects.toThrow(/boom/);
  });
});
