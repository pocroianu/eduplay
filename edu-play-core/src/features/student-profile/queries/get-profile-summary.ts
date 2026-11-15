import 'server-only';

import { cache } from 'react';
import { getActivityProgress, summarizeActivityProgress, getActivityStreak } from '@/features/activities/server';
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

  const [{ data: student }, progress, streakDays] = await Promise.all([
    supabase.from('students').select('username').eq('id', user.id).maybeSingle(),
    getActivityProgress(supabase, user.id),
    getActivityStreak(supabase, user.id),
  ]);

  const entries = progress ?? [];
  const completedCount = summarizeActivityProgress(entries).completedCount;
  const starsEarned = entries.reduce(
    (acc, entry) => acc + Math.floor((entry.score ?? 0) / 20),
    0,
  );
  const bestScore = entries.reduce((acc, entry) => Math.max(acc, entry.score ?? 0), 0);
  const level = Math.max(1, Math.floor(starsEarned / STARS_PER_LEVEL) + 1);

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

export const getStudentProfileSummary = cache(getProfileSummaryUncached);
