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

import { addStep } from '../add-step';
const input = { pathId: PATH_ID, kind: 'activity_template', title: 'Primul pas', targetActivityType: 'free-response' };
describe('append Learning Path step action', () => {
  it('returns the database-assigned order without requiring caller ordering', async () => {
    resultMock.mockResolvedValue({ data: { id: ACTOR_ID, path_id: PATH_ID, step_order: 3, kind: 'activity_template', title: 'Primul pas', target_activity_type: 'free-response', target_activity_config: {}, description: null, created_at: '2026-11-15' }, error: null });
    expect(await addStep(input)).toMatchObject({ success: true, data: { step: { stepOrder: 3, pathId: PATH_ID } } });
    expect(revalidatePathMock).toHaveBeenCalled();
  });
  it('validates input before writing', async () => {
    expect((await addStep({ ...input, targetActivityType: undefined })).success).toBe(false);
    expect(resultMock).not.toHaveBeenCalled();
  });
  it.each([
    ['learning_path_not_found', 'Parcursul nu există'],
    ['learning_path_not_draft', 'Nu poți adăuga pași la un parcurs publicat sau arhivat'],
    ['activity_type_not_found', 'Tipul de activitate ales nu există'],
    ['private database detail', 'Nu am putut adăuga pasul. Încearcă din nou.'],
  ])('translates transaction rejection %s', async (message, expected) => {
    resultMock.mockResolvedValue({ data: null, error: { message } });
    expect(await addStep(input)).toEqual({ success: false, error: expected });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
