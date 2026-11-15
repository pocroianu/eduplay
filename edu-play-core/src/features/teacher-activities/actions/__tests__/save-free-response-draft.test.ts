import { beforeEach, expect, it, vi } from 'vitest';
import { getTeacherActivityContext } from '../teacher-context';
import { saveFreeResponseDraft } from '../save-free-response-draft';

vi.mock('../teacher-context', () => ({ getTeacherActivityContext: vi.fn() }));
const revalidate = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidate(path) }));
const rpc = vi.fn();
const id = '11111111-1111-4111-8111-111111111111';
const draft = {
  title: 'Activitate', prompt: 'Spune o poveste.',
  allowedTools: { text: true, drawing: false, voice: false },
  shareWithFamilyOnApproval: false,
  resources: [{ title: 'Resursă', url: 'https://example.test/lesson' }],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTeacherActivityContext).mockResolvedValue({ supabase: { rpc }, userId: 'teacher' } as never);
  rpc.mockResolvedValue({ data: id, error: null });
});

it('rejects invalid fields and links before authenticating or writing', async () => {
  expect((await saveFreeResponseDraft({ ...draft, title: '' })).success).toBe(false);
  expect((await saveFreeResponseDraft({ ...draft, resources: [{ title: 'Bad', url: 'javascript:bad()' }] })).success).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
  expect(getTeacherActivityContext).not.toHaveBeenCalled();
});
it('saves content and ordered resources through one operation and refreshes only on success', async () => {
  expect(await saveFreeResponseDraft(draft)).toEqual({ success: true, data: { id } });
  expect(rpc).toHaveBeenCalledExactlyOnceWith('save_teacher_activity_draft', { p_draft: draft, p_activity_id: undefined });
  expect(revalidate).toHaveBeenCalledWith('/teacher/activities');
  revalidate.mockClear();
  rpc.mockResolvedValue({ data: null, error: { code: 'XX000' } });
  expect((await saveFreeResponseDraft(draft)).success).toBe(false);
  expect(revalidate).not.toHaveBeenCalled();
});
it('rejects an unauthenticated caller before invoking the draft operation', async () => {
  vi.mocked(getTeacherActivityContext).mockResolvedValue(null);
  expect((await saveFreeResponseDraft(draft)).success).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
