import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAgeBand, type AgeBand } from '@/shared/lib/utils/age';

export interface StudentProfileSummary {
  id: string;
  full_name: string;
  avatar_url: string | null;
  username: string | null;
  ageBand: AgeBand | undefined;
  date_of_birth: string | null;
  stats: {
    gamesPlayed: number;
    completedCount: number;
    starsEarned: number;
    bestScore: number;
    streakDays: number;
    level: number;
  };
}

const STARS_PER_LEVEL = 25;

async function getProfileSummaryUncached(): Promise<StudentProfileSummary | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, date_of_birth, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'student') return null;

  const [{ data: student }, { data: progress }] = await Promise.all([
    supabase.from('students').select('username').eq('id', user.id).maybeSingle(),
    supabase
      .from('activity_progress')
      .select('status, score, last_played_at, completed_at')
      .eq('student_id', user.id),
  ]);

  const entries = progress ?? [];
  const completedCount = entries.filter((entry) => entry.status === 'completed').length;
  const starsEarned = entries.reduce(
    (acc, entry) => acc + Math.floor((entry.score ?? 0) / 20),
    0,
  );
  const bestScore = entries.reduce((acc, entry) => Math.max(acc, entry.score ?? 0), 0);
  const level = Math.max(1, Math.floor(starsEarned / STARS_PER_LEVEL) + 1);

  // Streak: count distinct calendar days with activity ending today / yesterday.
  const streakDays = computeStreak(entries.map((entry) => entry.last_played_at ?? entry.completed_at ?? null));

  return {
    id: profile.id,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    username: student?.username ?? null,
    ageBand: getAgeBand(profile.date_of_birth),
    date_of_birth: profile.date_of_birth,
    stats: {
      gamesPlayed: entries.length,
      completedCount,
      starsEarned,
      bestScore,
      streakDays,
      level,
    },
  };
}

function computeStreak(timestamps: Array<string | null>): number {
  const days = new Set<string>();
  for (const ts of timestamps) {
    if (!ts) continue;
    const day = new Date(ts).toISOString().slice(0, 10);
    days.add(day);
  }
  if (days.size === 0) return 0;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let streak = 0;
  let cursor = today;
  // allow most recent day to be yesterday
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor = new Date(cursor.getTime() - 86_400_000);
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}

export const getStudentProfileSummary = cache(getProfileSummaryUncached);
