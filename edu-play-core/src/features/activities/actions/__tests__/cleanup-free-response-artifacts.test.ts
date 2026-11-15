import { beforeEach, expect, it, vi } from 'vitest';
import { cleanupFreeResponseArtifacts } from '../record-free-response-artifact';

const admin = vi.fn();
const learner = '11111111-1111-4111-8111-111111111111';
const assignmentId = '22222222-2222-4222-8222-222222222222';
const artifactId = '33333333-3333-4333-8333-333333333333';
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: learner } } }) } }),
  createAdminClient: () => admin(),
}));
vi.mock('@/features/portfolio', () => ({ recordChildArtifact: vi.fn() }));

const remove = vi.fn();
const erase = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  remove.mockResolvedValue({ error: null });
  erase.mockResolvedValue({ error: null });
  const selection = {
    select: () => selection, eq: () => selection,
    in: async () => ({ data: [{ id: artifactId, storage_path: 'owned/file.png',
      metadata: { activityTypeId: 'free-response', assignmentId } }], error: null }),
    delete: () => ({ in: erase }),
  };
  admin.mockReturnValue({ from: () => selection, storage: { from: () => ({ remove }) } });
});
it('reports a storage deletion failure and preserves the artifact row for retry', async () => {
  remove.mockResolvedValue({ error: { message: 'offline' } });
  expect(await cleanupFreeResponseArtifacts({ assignmentId, artifactIds: [artifactId] })).toEqual({ success: false });
  expect(erase).not.toHaveBeenCalled();
});
it('reports a row deletion failure instead of claiming compensation succeeded', async () => {
  erase.mockResolvedValue({ error: { message: 'offline' } });
  expect(await cleanupFreeResponseArtifacts({ assignmentId, artifactIds: [artifactId] })).toEqual({ success: false });
});
