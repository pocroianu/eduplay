import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';
import { getActivityProgress, summarizeActivityProgress } from '@/features/activities/server';

const SUBJECTS = [
  { key: 'math', subject: 'Matematică', shortLabel: 'Mat', color: 'var(--color-primary)' },
  { key: 'romanian', subject: 'Română', shortLabel: 'Rom', color: 'var(--color-coral)' },
  { key: 'science', subject: 'Științe', shortLabel: 'Ști', color: 'var(--color-success)' },
  { key: 'english', subject: 'Engleză', shortLabel: 'Eng', color: 'var(--color-gold)' },
] as const;

/** Report projections share score and time policy with the learner detail views. */
export async function getStudentReportProgress(supabase: SupabaseClient<Database>, studentId: string) {
  const entries = await getActivityProgress(supabase, studentId);
  const summary = summarizeActivityProgress(entries);
  const subjectProgress = SUBJECTS.map(({ key, ...labels }) => {
    const totals = summarizeActivityProgress(entries.filter((row) => row.activities?.category === key));
    return { ...labels, score: totals.averageScore, hoursSpent: totals.totalHours };
  });
  const gameHistory = entries.map((row) => ({
    id: row.id,
    gameName: row.activities?.title || 'Necunoscut',
    subject: row.activities?.category || 'Altele',
    score: row.score ?? 0,
    maxScore: 100,
    completedAt: row.completed_at ?? row.last_played_at ?? '',
    duration: `${Math.round((row.time_spent ?? 0) / 60)}m`,
  }));
  const recentActivity = gameHistory.slice(0, 10).map((entry) => ({
    id: entry.id,
    title: entry.gameName,
    description: `A jucat ${entry.gameName}`,
    timestamp: entry.completedAt,
    type: 'game' as const,
  }));
  return { summary, subjectProgress, gameHistory, recentActivity };
}
