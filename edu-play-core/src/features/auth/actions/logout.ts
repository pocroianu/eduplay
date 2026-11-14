'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants';

export async function logout() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error('Nu am putut închide sesiunea. Te rugăm să încerci din nou.');
  }

  redirect(ROUTES.AUTH.LOGIN);
}
