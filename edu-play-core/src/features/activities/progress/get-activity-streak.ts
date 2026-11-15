import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { calculateActivityStreak } from './activity-streak';

export async function getActivityStreak(
  client: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  now = new Date(),
): Promise<number> {
  const days: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('activity_days').select('active_day')
      .eq('student_id', studentId).order('active_day', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error('Unable to read Activity streak history');
    days.push(...(data ?? []).map(row => row.active_day));
    if (!data || data.length < pageSize) break;
  }
  return calculateActivityStreak(days, now);
}
