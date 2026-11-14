import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { activityInstanceIdSchema } from '../schemas';
import type { ActivityInstance } from '../types';
import {
  ACTIVITY_INSTANCE_SELECT,
  mapActivityInstanceRow,
  type ActivityInstanceRow,
} from './types';

/**
 * Fetches a single activity instance by id. RLS decides whether the calling
 * user may see the row at all; missing rows return `null` so the player
 * route can render a 404 without a thrown error.
 *
 * A malformed `id` (e.g. a non-UUID route segment) also returns `null`
 * rather than letting Postgres raise a UUID-syntax error — same 404 outcome
 * as a missing row, no 500 leak.
 */
export async function getActivityInstance(
  supabase: SupabaseClient,
  id: string,
): Promise<ActivityInstance | null> {
  const parsed = activityInstanceIdSchema.safeParse({ id });
  if (!parsed.success) return null;

  const { data, error } = await supabase
    .from('activity_instances')
    .select(ACTIVITY_INSTANCE_SELECT)
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (error) {
    throw new Error(`getActivityInstance failed: ${error.message}`);
  }

  if (!data) return null;

  return mapActivityInstanceRow(data as ActivityInstanceRow);
}
