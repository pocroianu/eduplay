'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants';
import { updateAvatarSchema } from '../schemas/avatar.schema';

export interface UpdateAvatarResult {
  success: boolean;
  error?: string;
  avatarUrl?: string;
}

export async function updateAvatarAction(
  input: { avatarUrl: string },
): Promise<UpdateAvatarResult> {
  const parsed = updateAvatarSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Avatarul ales nu este valid.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Sesiunea ta a expirat. Conectează-te din nou.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'student') {
    return { success: false, error: 'Nu ai permisiunea să schimbi acest avatar.' };
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: parsed.data.avatarUrl })
    .eq('id', user.id);

  if (profileError) {
    return { success: false, error: 'Nu am putut salva avatarul. Încearcă din nou.' };
  }

  // Mirror the URL onto the students row so teacher views stay consistent.
  await supabase
    .from('students')
    .update({ avatar_url: parsed.data.avatarUrl })
    .eq('id', user.id);

  revalidatePath(ROUTES.STUDENT.PROFILE);
  revalidatePath(ROUTES.STUDENT.DASHBOARD);

  return { success: true, avatarUrl: parsed.data.avatarUrl };
}
