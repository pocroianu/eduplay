import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@/lib/supabase/server';
const progressMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock('@/features/activities/server', async () => ({
  ...await vi.importActual<typeof import('@/features/activities/server')>('@/features/activities/server'),
  getActivityProgress: (...args: unknown[]) => progressMock(...args),
}));
import { getStudentReportProgress } from './get-student-report-progress';
beforeEach(() => vi.clearAllMocks());
describe('Student report progress', () => {
  it('projects saved time and the same completed-score policy for totals and subjects', async () => {
    progressMock.mockResolvedValue([
      { id: '1', activity_id: 'a', status: 'completed', score: 80, time_spent: 3600, completed_at: '2026-11-15', last_played_at: '2026-11-15', activities: { title: 'Numere', category: 'math' } },
      { id: '2', activity_id: 'b', status: 'in_progress', score: 10, time_spent: 1800, completed_at: null, last_played_at: '2026-11-14', activities: { title: 'Forme', category: 'math' } },
    ]);
    const result = await getStudentReportProgress(await createClient(), 'student');
    expect(result.summary).toMatchObject({ averageScore: 80, totalMinutes: 90 });
    expect(result.subjectProgress[0]).toMatchObject({ score: 80, hoursSpent: 1.5 });
    expect(result.gameHistory.map((entry) => entry.duration)).toEqual(['60m', '30m']);
  });
});
