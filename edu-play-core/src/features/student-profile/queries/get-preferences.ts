import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_PREFERENCES, type PreferencesFormData } from '../schemas/preferences.schema';

async function getPreferencesUncached(profileId: string): Promise<PreferencesFormData> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profile_preferences')
    .select('sound_enabled, reduced_motion, theme')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (!data) {
    return { ...DEFAULT_PREFERENCES };
  }

  return {
    sound_enabled: data.sound_enabled ?? DEFAULT_PREFERENCES.sound_enabled,
    reduced_motion: data.reduced_motion ?? DEFAULT_PREFERENCES.reduced_motion,
    theme: (data.theme as PreferencesFormData['theme']) ?? DEFAULT_PREFERENCES.theme,
  };
}

/**
 * Read the current student's preferences. Falls back to {@link DEFAULT_PREFERENCES}
 * when no row exists (first-time visitors).
 *
 * Wrapped in React `cache()` so that multiple consumers in the same render
 * pass — e.g. PreferencesProvider in the dashboard layout AND the profile
 * page itself — share a single Supabase round-trip.
 */
export const getPreferences = cache(getPreferencesUncached);
