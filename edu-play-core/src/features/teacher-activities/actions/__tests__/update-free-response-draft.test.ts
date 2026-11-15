import { beforeEach, expect, it, vi } from 'vitest';
import { getTeacherActivityContext } from '../teacher-context';
import { updateFreeResponseDraft } from '../update-free-response-draft';

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

it('sends the editable Activity identity through the same atomic operation', async () => {
  expect(await updateFreeResponseDraft(id, draft)).toEqual({ success: true, data: { id } });
  expect(rpc).toHaveBeenCalledExactlyOnceWith('save_teacher_activity_draft', { p_draft: draft, p_activity_id: id });
  expect(revalidate).toHaveBeenCalledWith('/teacher/activities/' + id + '/edit');
});
it.each(['42501', '23514'])('reports denied ownership or ready-state edits without cache refresh: %s', async code => {
  rpc.mockResolvedValue({ data: null, error: { code } });
  expect((await updateFreeResponseDraft(id, draft)).success).toBe(false);
  expect(revalidate).not.toHaveBeenCalled();
});
it('validates identity and draft before any write', async () => {
  expect((await updateFreeResponseDraft('', draft)).success).toBe(false);
  expect((await updateFreeResponseDraft(id, { ...draft, prompt: '' })).success).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
