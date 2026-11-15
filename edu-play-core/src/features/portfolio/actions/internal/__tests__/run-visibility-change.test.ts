
import { beforeEach, describe, expect, it, vi } from 'vitest';
const requireRoleMock = vi.fn();
const revalidatePathMock = vi.fn();
const resultMock = vi.fn();
const notifyMock = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('@/lib/api', async () => ({
  ...await vi.importActual<typeof import('@/lib/api')>('@/lib/api'),
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock('../notify-artifact-published', () => ({ notifyArtifactPublished: (...args: unknown[]) => notifyMock(...args) }));
import { ApiError } from '@/lib/api';
import { runVisibilityChange } from '../run-visibility-change';
const ID = '11111111-1111-4111-8111-111111111111';
const row = { id: ID, student_id: ID, class_id: ID, title: 'Desen', artifact_type: 'photo', storage_path: 'p', visibility: 'family_visible', reviewed_by: ID, reviewed_at: '2026-11-15', created_at: '2026-11-15', updated_at: '2026-11-15', metadata: {} };
beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({ user: { id: ID }, supabase: { rpc: () => ({ maybeSingle: resultMock }) } });
  notifyMock.mockResolvedValue(undefined);
});
describe('Portfolio visibility action', () => {
  it('notifies for a committed transition and refreshes teacher and parent views', async () => {
    resultMock.mockResolvedValue({ data: { artifact: row, became_family_visible: true }, error: null });
    expect(await runVisibilityChange({ id: ID, visibility: 'family_visible' })).toMatchObject({ success: true, data: { artifact: { visibility: 'family_visible', reviewedBy: ID } } });
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/portfolio');
    expect(revalidatePathMock).toHaveBeenCalledWith('/parent');
  });
  it('does not notify for the losing retry', async () => {
    resultMock.mockResolvedValue({ data: { artifact: row, became_family_visible: false }, error: null });
    expect((await runVisibilityChange({ id: ID, visibility: 'family_visible' })).success).toBe(true);
    expect(notifyMock).not.toHaveBeenCalled();
  });
  it('keeps internal decisions out of the parent feed', async () => {
    resultMock.mockResolvedValue({ data: { artifact: { ...row, visibility: 'internal_teacher_only' }, became_family_visible: false }, error: null });
    expect((await runVisibilityChange({ id: ID, visibility: 'internal_teacher_only' })).success).toBe(true);
    expect(notifyMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalledWith('/parent');
  });
  it('returns not found for invisible rows', async () => {
    resultMock.mockResolvedValue({ data: null, error: null });
    expect(await runVisibilityChange({ id: ID, visibility: 'family_visible' })).toMatchObject({ success: false, error: 'Artefactul nu a fost găsit' });
  });
  it('does not expose database errors', async () => {
    resultMock.mockResolvedValue({ data: null, error: { message: 'private' } });
    expect(await runVisibilityChange({ id: ID, visibility: 'family_visible' })).toMatchObject({ success: false, error: 'Eroare la actualizarea artefactului' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
  it('rejects unauthorized callers', async () => {
    requireRoleMock.mockRejectedValue(ApiError.forbidden());
    expect((await runVisibilityChange({ id: ID, visibility: 'family_visible' })).success).toBe(false);
    expect(resultMock).not.toHaveBeenCalled();
  });
});
