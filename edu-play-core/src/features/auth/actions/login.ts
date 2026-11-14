'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginSchema } from '../schemas/login.schema';
import { ROUTES } from '@/shared/lib/constants';
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  recordFailedLogin,
} from '../utils/login-rate-limit';

const LOGIN_ERROR_MESSAGE = 'Email sau parolă incorectă.';
const PROFILE_ERROR_MESSAGE = 'Nu am putut deschide contul. Te rugăm să încerci din nou.';
const ROLE_DASHBOARD: Record<string, string> = {
  teacher: ROUTES.TEACHER.DASHBOARD,
  parent: ROUTES.PARENT.DASHBOARD,
  admin: ROUTES.ADMIN.DASHBOARD,
};

export async function login(formData: FormData) {
  const supabase = await createClient();

  const validated = loginSchema.parse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  const rateLimit = await checkLoginRateLimit(validated.email);
  if (!rateLimit.allowed) {
    throw new Error(
      `Prea multe încercări. Încearcă din nou în ${rateLimit.retryAfterMinutes} minute.`
    );
  }

  const { error, data } = await supabase.auth.signInWithPassword({
    email: validated.email,
    password: validated.password,
  });

  if (error) {
    await recordFailedLogin(validated.email);
    throw new Error(LOGIN_ERROR_MESSAGE);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    throw new Error(PROFILE_ERROR_MESSAGE);
  }

  await clearLoginAttempts(validated.email);

  const dashboard = ROLE_DASHBOARD[profile.role];
  if (!dashboard) {
    await supabase.auth.signOut();
    throw new Error(PROFILE_ERROR_MESSAGE);
  }

  redirect(dashboard);
}
