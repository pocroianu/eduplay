import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CONSENT_KEYS, type ConsentMap } from '@/features/activities';
import type { Database } from '@/shared/types/database';

const VALID_KEYS: ReadonlySet<string> = new Set(CONSENT_KEYS);

/**
 * Reads the per-child consent map off `students.consents`. RLS already
 * scopes the right caller-to-row relationships:
 *   - Students see their own row via the `Students can view own profile`
 *     SELECT policy (`auth.uid() = id`) — sufficient for the activity
 *     player's gate resolution.
 *   - Parents see their linked children via the `Parents can view their
 *     children` policy on the `parent_children` junction.
 *
 * The JSONB column stores `Partial<Record<ConsentKey, boolean>>`. We only
 * surface keys that match a known `ConsentKey`; anything else (including
 * non-boolean values for a known key) is dropped silently so the gate
 * decision never relies on garbage data.
 */
export async function getChildConsents(
  supabase: SupabaseClient<Database>,
  childId: string,
): Promise<ConsentMap> {
  const { data, error } = await supabase
    .from('students')
    .select('consents')
    .eq('id', childId)
    .maybeSingle();

  if (error || !data) {
    return {};
  }

  const raw = data.consents;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const map: ConsentMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (VALID_KEYS.has(key) && typeof value === 'boolean') {
      map[key as keyof ConsentMap] = value;
    }
  }
  return map;
}
