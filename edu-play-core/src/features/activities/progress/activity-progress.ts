export interface ProgressEntry {
  activity_id: string;
  status: string | null;
  score: number | null;
  time_spent: number | null;
  last_played_at: string | null;
}

/** Scores describe completed, scored Activities; time includes unfinished play. */
export function summarizeActivityProgress(entries: readonly ProgressEntry[]) {
  const scores = entries.flatMap((entry) => entry.status === 'completed' && entry.score !== null ? [entry.score] : []);
  const totalSeconds = entries.reduce((total, entry) => total + (entry.time_spent ?? 0), 0);
  const timestamps = entries.flatMap((entry) => entry.last_played_at ? [entry.last_played_at] : []);
  return {
    activityCount: new Set(entries.map((entry) => entry.activity_id)).size,
    completedCount: entries.filter((entry) => entry.status === 'completed').length,
    inProgressCount: entries.filter((entry) => entry.status === 'in_progress').length,
    averageScore: scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length * 10) / 10 : 0,
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    totalHours: totalSeconds / 3600,
    lastActivityAt: timestamps.reduce<string | null>((latest, value) => !latest || value > latest ? value : latest, null),
  };
}
