import { describe, expect, it } from 'vitest';
import { summarizeActivityProgress, type ProgressEntry } from './activity-progress';

describe('Activity progress summary', () => {
  it('averages only completed scored Activities while counting all saved play time', () => {
    const entries: ProgressEntry[] = [
      { activity_id: 'a', status: 'completed', score: 80, time_spent: 120, last_played_at: '2026-11-14' },
      { activity_id: 'b', status: 'completed', score: 100, time_spent: 60, last_played_at: '2026-11-15' },
      { activity_id: 'c', status: 'completed', score: null, time_spent: 60, last_played_at: null },
      { activity_id: 'd', status: 'in_progress', score: 10, time_spent: 120, last_played_at: null },
    ];
    expect(summarizeActivityProgress(entries)).toEqual({
      activityCount: 4, completedCount: 3, inProgressCount: 1, averageScore: 90,
      totalSeconds: 360, totalMinutes: 6, totalHours: 0.1, lastActivityAt: '2026-11-15',
    });
  });
  it('keeps a genuine zero score and returns safe empty totals', () => {
    expect(summarizeActivityProgress([
      { activity_id: 'a', status: 'completed', score: 0, time_spent: null, last_played_at: null },
      { activity_id: 'b', status: 'completed', score: 100, time_spent: null, last_played_at: null },
    ]).averageScore).toBe(50);
    expect(summarizeActivityProgress([])).toMatchObject({ averageScore: 0, totalSeconds: 0, lastActivityAt: null });
  });
});
