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

import { ApiError } from '@/lib/api';
import { createPath } from '../create-path';
import { fakeInsertSupabase, type InsertCapture } from './test-helpers';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const PATH_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  requireRoleMock.mockReset();
  revalidatePathMock.mockReset();
});

describe('createPath', () => {
  it('returns a Romanian validation error for invalid input', async () => {
    const result = await createPath({ title: 'A' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Titlul/);
    expect(requireRoleMock).not.toHaveBeenCalled();
  });

  it('returns a friendly auth error when the user lacks teacher role', async () => {
    requireRoleMock.mockRejectedValueOnce(ApiError.forbidden());
    const result = await createPath({ title: 'Aventura' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Nu ai permisiunea pentru această acțiune');
  });

  it('inserts a draft path on the happy path and revalidates the dashboard', async () => {
    const capture: InsertCapture = {};
    const supabase = fakeInsertSupabase(
      {
        data: {
          id: PATH_ID,
          title: 'Aventura',
          description: null,
          age_min: null,
          age_max: null,
          status: 'draft',
          owner_kind: 'teacher',
          created_by: ACTOR_ID,
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-01T00:00:00Z',
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

    const result = await createPath({ title: 'Aventura' });

    expect(result.success).toBe(true);
    expect(result.data?.path.id).toBe(PATH_ID);
    expect(capture.table).toBe('learning_paths');
    expect(capture.payload).toMatchObject({
      title: 'Aventura',
      created_by: ACTOR_ID,
      status: 'draft',
      owner_kind: 'teacher',
    });
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it('uses owner_kind=admin when the caller is an admin', async () => {
    const capture: InsertCapture = {};
    const supabase = fakeInsertSupabase(
      {
        data: {
          id: PATH_ID,
          title: 'Aventura',
          description: null,
          age_min: null,
          age_max: null,
          status: 'draft',
          owner_kind: 'admin',
          created_by: ACTOR_ID,
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-01T00:00:00Z',
        },
        error: null,
      },
      capture,
    );

    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: 'a@example.com' },
      profile: { id: ACTOR_ID, role: 'admin', full_name: 'A' },
      supabase,
    });

    await createPath({ title: 'Aventura' });
    expect(capture.payload?.owner_kind).toBe('admin');
  });

  it('returns a friendly DB error when the insert is rejected (RLS-negative)', async () => {
    const capture: InsertCapture = {};
    const supabase = fakeInsertSupabase(
      { data: null, error: { message: 'rls denied' } },
      capture,
    );

    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: 't@example.com' },
      profile: { id: ACTOR_ID, role: 'teacher', full_name: 'T' },
      supabase,
    });

    const result = await createPath({ title: 'Aventura' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Nu am putut crea parcursul. Încearcă din nou.');
  });
});
