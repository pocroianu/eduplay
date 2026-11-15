import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';

/** The authenticated client's RLS remains authoritative for learner visibility. */
export async function getActivityProgress(supabase: SupabaseClient<Database>, studentId: string) {
  const { data, error } = await supabase
    .from('activity_progress')
    .select('*, activities:activity_id (title, category, difficulty)')
    .eq('student_id', studentId)
    .order('last_played_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
