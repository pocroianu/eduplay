import { beforeEach, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const auth = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, requireAuth: () => auth() };
});
import { GET } from './route';

const learner = '11111111-1111-4111-8111-111111111111';
const assignment = '22222222-2222-4222-8222-222222222222';
const fetch = vi.fn<typeof globalThis.fetch>();
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({
    supabase: createClient('https://example.test', 'test-key', {
      global: { fetch }, auth: { persistSession: false, autoRefreshToken: false },
    }),
    user: { id: learner }, profile: { role: 'student' },
  });
  fetch.mockResolvedValue(new Response('null', { headers: { 'Content-Type': 'application/json' } }));
});
it('reconciles through a read scoped to both the assignment and authenticated learner', async () => {
  const response = await GET(new Request(`https://example.test/api/v1/activity-submissions?assignmentId=${assignment}`));
  expect(response.status).toBe(200);
  expect((await response.json()).data).toBeNull();
  const request = new URL(String(fetch.mock.calls[0][0]));
  expect(request.searchParams.get('assignment_id')).toBe(`eq.${assignment}`);
  expect(request.searchParams.get('student_id')).toBe(`eq.${learner}`);
  expect(fetch.mock.calls[0][1]?.method).toBe('GET');
});
it('rejects a non-student without reading submission data', async () => {
  auth.mockResolvedValue({ user: { id: learner }, profile: { role: 'teacher' }, supabase: {} });
  const response = await GET(new Request(`https://example.test/api/v1/activity-submissions?assignmentId=${assignment}`));
  expect(response.status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});
