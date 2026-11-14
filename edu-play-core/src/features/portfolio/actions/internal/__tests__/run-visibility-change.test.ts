import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRoleMock = vi.fn();
const revalidatePathMock = vi.fn();
const notifyArtifactPublishedMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

vi.mock('@/lib/api', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    requireRole: (...args: unknown[]) => requireRoleMock(...args),
  };
});

vi.mock('../notify-artifact-published', () => ({
  notifyArtifactPublished: (...args: unknown[]) =>
    notifyArtifactPublishedMock(...args),
}));

import { ApiError } from '@/lib/api';
import { runVisibilityChange } from '../run-visibility-change';

const ARTIFACT_ID = '11111111-1111-1111-1111-111111111111';
const ACTOR_ID = '22222222-2222-2222-2222-222222222222';

interface FakeUpdate {
  data?: unknown;
  error?: { message: string } | null;
}

interface UpdateCapture {
  table?: string;
  payload?: Record<string, unknown>;
  filterColumn?: string;
  filterValue?: unknown;
}

/**
 * Each `.from('child_artifacts')` invocation is treated as a separate query
 * (prior-read first, then UPDATE). Pass a queue of results so the prior-read
 * and the UPDATE can return different rows.
 */
function fakeSupabaseUpdate(
  results: FakeUpdate | FakeUpdate[],
  capture: UpdateCapture,
) {
  const queue = Array.isArray(results) ? [...results] : [results, results];
  return {
    from: vi.fn((table: string) => {
      capture.table = table;
      const result = queue.shift() ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      let sawUpdate = false;
      builder.update = vi.fn((payload: Record<string, unknown>) => {
        capture.payload = payload;
        sawUpdate = true;
        return builder;
      });
      builder.eq = vi.fn((column: string, value: unknown) => {
        // Only the UPDATE chain's filter is interesting for assertion.
        if (sawUpdate) {
          capture.filterColumn = column;
          capture.filterValue = value;
        }
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
  notifyArtifactPublishedMock.mockReset();
  notifyArtifactPublishedMock.mockResolvedValue(undefined);
});

describe('runVisibilityChange', () => {
  it('returns success and revalidates both surfaces on a happy path', async () => {
    const capture: UpdateCapture = {};
    const supabase = fakeSupabaseUpdate(
      [
        { data: { visibility: 'draft' }, error: null },
        {
          data: {
            id: ARTIFACT_ID,
            student_id: 'sid',
            class_id: 'cid',
            title: null,
            artifact_type: 'photo',
            storage_path: 'p',
            visibility: 'family_visible',
            reviewed_by: ACTOR_ID,
            reviewed_at: '2026-05-01T00:00:00Z',
            created_at: '2026-05-01T00:00:00Z',
            updated_at: '2026-05-01T00:00:00Z',
          },
          error: null,
        },
      ],
      capture,
    );
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: ACTOR_ID, email: 'teacher@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
    });

    const result = await runVisibilityChange({
      id: ARTIFACT_ID,
      visibility: 'family_visible',
    });

    expect(result.success).toBe(true);
    expect(result.data?.artifact.visibility).toBe('family_visible');
    expect(result.data?.artifact.reviewedBy).toBe(ACTOR_ID);

    expect(capture.table).toBe('child_artifacts');
    expect(capture.filterColumn).toBe('id');
    expect(capture.filterValue).toBe(ARTIFACT_ID);
    expect(capture.payload?.visibility).toBe('family_visible');
    expect(capture.payload?.reviewed_by).toBe(ACTOR_ID);
    expect(typeof capture.payload?.reviewed_at).toBe('string');

    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/portfolio');
    expect(revalidatePathMock).toHaveBeenCalledWith('/parent');

    expect(notifyArtifactPublishedMock).toHaveBeenCalledTimes(1);
    expect(notifyArtifactPublishedMock).toHaveBeenCalledWith({
      supabase,
      artifact: {
        id: ARTIFACT_ID,
        student_id: 'sid',
        title: null,
        artifact_type: 'photo',
      },
    });
  });

  it('approves teacher/student-only responses without notifying or revalidating parent surfaces', async () => {
    const capture: UpdateCapture = {};
    const supabase = fakeSupabaseUpdate(
      [
        { data: { visibility: 'draft' }, error: null },
        {
          data: {
            id: ARTIFACT_ID,
            student_id: 'sid',
            class_id: 'cid',
            title: null,
            artifact_type: 'photo',
            storage_path: 'p',
            visibility: 'internal_teacher_only',
            reviewed_by: ACTOR_ID,
            reviewed_at: '2026-05-01T00:00:00Z',
            metadata: {},
            created_at: '2026-05-01T00:00:00Z',
            updated_at: '2026-05-01T00:00:00Z',
          },
          error: null,
        },
      ],
      capture,
    );
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: ACTOR_ID, email: 'teacher@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
    });

    const result = await runVisibilityChange({
      id: ARTIFACT_ID,
      visibility: 'internal_teacher_only',
    });

    expect(result.success).toBe(true);
    expect(result.data?.artifact.visibility).toBe('internal_teacher_only');
    expect(capture.payload?.visibility).toBe('internal_teacher_only');
    expect(capture.payload?.reviewed_by).toBe(ACTOR_ID);
    expect(typeof capture.payload?.reviewed_at).toBe('string');
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/portfolio');
    expect(revalidatePathMock).not.toHaveBeenCalledWith('/parent');
    expect(notifyArtifactPublishedMock).not.toHaveBeenCalled();
  });

  it('does NOT stamp reviewed_by/at when transitioning back to draft', async () => {
    const capture: UpdateCapture = {};
    const supabase = fakeSupabaseUpdate(
      {
        data: {
          id: ARTIFACT_ID,
          student_id: 's',
          class_id: 'c',
          title: null,
          artifact_type: 'photo',
          storage_path: 'p',
          visibility: 'draft',
          reviewed_by: null,
          reviewed_at: null,
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-01T00:00:00Z',
        },
        error: null,
      },
      capture,
    );
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: ACTOR_ID, email: 'teacher@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
    });

    const result = await runVisibilityChange({
      id: ARTIFACT_ID,
      visibility: 'draft',
    });

    expect(result.success).toBe(true);
    expect(capture.payload?.visibility).toBe('draft');
    expect('reviewed_by' in (capture.payload ?? {})).toBe(false);
    expect('reviewed_at' in (capture.payload ?? {})).toBe(false);
    expect(notifyArtifactPublishedMock).not.toHaveBeenCalled();
  });

  it('returns a forbidden error when requireRole denies', async () => {
    requireRoleMock.mockRejectedValue(ApiError.forbidden());

    const result = await runVisibilityChange({
      id: ARTIFACT_ID,
      visibility: 'family_visible',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permisiunea/i);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('returns an unauthorized error when requireRole has no user', async () => {
    requireRoleMock.mockRejectedValue(ApiError.unauthorized());

    const result = await runVisibilityChange({
      id: ARTIFACT_ID,
      visibility: 'family_visible',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/autentificat/i);
  });

  it('returns "not found" when the row is missing or RLS-hidden', async () => {
    const supabase = fakeSupabaseUpdate({ data: null, error: null }, {});
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: ACTOR_ID, email: 'teacher@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
    });

    const result = await runVisibilityChange({
      id: ARTIFACT_ID,
      visibility: 'family_visible',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/găsit/i);
  });

  it('surfaces a generic error when the DB write errors', async () => {
    const supabase = fakeSupabaseUpdate(
      { data: null, error: { message: 'rls denied' } },
      {},
    );
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: ACTOR_ID, email: 'teacher@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
    });

    const result = await runVisibilityChange({
      id: ARTIFACT_ID,
      visibility: 'family_visible',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/actualizarea/i);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('does NOT re-fire notifyArtifactPublished when artifact is already family_visible', async () => {
    // Simulates an idempotent re-publish (retry, double-tap, second tab):
    // prior-read returns visibility=family_visible, UPDATE no-ops onto the
    // same state. The fan-out must skip — parents must not receive a
    // duplicate notification.
    const publishedRow = {
      id: ARTIFACT_ID,
      student_id: 'sid',
      class_id: 'cid',
      title: null,
      artifact_type: 'photo',
      storage_path: 'p',
      visibility: 'family_visible',
      reviewed_by: ACTOR_ID,
      reviewed_at: '2026-05-01T00:00:00Z',
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    };
    const supabase = fakeSupabaseUpdate(
      [
        { data: { visibility: 'family_visible' }, error: null },
        { data: publishedRow, error: null },
      ],
      {},
    );
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: ACTOR_ID, email: 'teacher@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
    });

    const result = await runVisibilityChange({
      id: ARTIFACT_ID,
      visibility: 'family_visible',
    });

    expect(result.success).toBe(true);
    expect(notifyArtifactPublishedMock).not.toHaveBeenCalled();
  });
});
