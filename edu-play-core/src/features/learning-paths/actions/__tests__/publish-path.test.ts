import { beforeEach, describe, expect, it, vi } from 'vitest';
const requireRoleMock = vi.fn();
const revalidatePathMock = vi.fn();
const resultMock = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('@/lib/api', async () => ({
  ...await vi.importActual<typeof import('@/lib/api')>('@/lib/api'),
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
const PATH_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({
    user: { id: ACTOR_ID, email: 'teacher@test.invalid' },
    profile: { id: ACTOR_ID, role: 'teacher', full_name: 'Teacher' },
    supabase: { rpc: () => ({ single: resultMock }) },
  });
});

import { publishPath } from '../publish-path';
describe('publish Learning Path action', () => {
  it('returns a published definition from the transaction', async () => {
    resultMock.mockResolvedValue({ data: { id: PATH_ID, title: 'Aventura', description: null, age_min: null, age_max: null, status: 'published', owner_kind: 'teacher', created_by: ACTOR_ID, created_at: '2026-11-15', updated_at: '2026-11-15' }, error: null });
    expect(await publishPath({ pathId: PATH_ID })).toMatchObject({ success: true, data: { path: { status: 'published' } } });
    expect(revalidatePathMock).toHaveBeenCalled();
  });
  it('validates before publication', async () => {
    expect((await publishPath({ pathId: 'invalid' })).success).toBe(false);
    expect(resultMock).not.toHaveBeenCalled();
  });
  it.each([
    ['learning_path_empty', 'Adaugă cel puțin un pas înainte să publici parcursul'],
    ['learning_path_not_found', 'Parcursul nu a fost găsit sau nu mai este în lucru'],
    ['learning_path_not_draft', 'Parcursul nu a fost găsit sau nu mai este în lucru'],
    ['private database detail', 'Nu am putut publica parcursul. Încearcă din nou.'],
  ])('translates transaction rejection %s', async (message, expected) => {
    resultMock.mockResolvedValue({ data: null, error: { message } });
    expect(await publishPath({ pathId: PATH_ID })).toEqual({ success: false, error: expected });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
