'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants';
import { preferencesSchema, type PreferencesFormData } from '../schemas/preferences.schema';

export interface UpdatePreferencesResult {
  success: boolean;
  error?: string;
  preferences?: PreferencesFormData;
}

export async function updatePreferencesAction(
  input: Partial<PreferencesFormData>,
): Promise<UpdatePreferencesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Sesiunea ta a expirat. Conectează-te din nou.' };
  }

  // Read current row so partial updates merge cleanly into the upsert.
  const { data: existing } = await supabase
    .from('profile_preferences')
    .select('sound_enabled, reduced_motion, theme')
    .eq('profile_id', user.id)
    .maybeSingle();

  const merged: PreferencesFormData = {
    sound_enabled: input.sound_enabled ?? existing?.sound_enabled ?? true,
    reduced_motion: input.reduced_motion ?? existing?.reduced_motion ?? false,
    theme:
      input.theme ??
      ((existing?.theme as PreferencesFormData['theme']) ?? 'auto'),
  };

  const parsed = preferencesSchema.safeParse(merged);
  if (!parsed.success) {
    return { success: false, error: 'Setările alese nu sunt valide.' };
  }

  const { error } = await supabase
    .from('profile_preferences')
    .upsert(
      { profile_id: user.id, ...parsed.data },
      { onConflict: 'profile_id' },
    );

  if (error) {
    return { success: false, error: 'Nu am putut salva setările. Încearcă din nou.' };
  }

  revalidatePath(ROUTES.STUDENT.PROFILE);
  revalidatePath(ROUTES.STUDENT.DASHBOARD);

  return { success: true, preferences: parsed.data };
}
