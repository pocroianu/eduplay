'use server';

import { createClient } from '@/lib/supabase/server';
import {
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
} from '@/features/auth/utils/login-rate-limit';
import { studentPinToAuthPassword } from '@/features/auth/server';
import { changePinSchema } from '../schemas/pin.schema';

export interface ChangePinResult {
  success: boolean;
  error?: string;
}

export async function changePinAction(input: {
  currentPin: string;
  newPin: string;
  confirmPin: string;
}): Promise<ChangePinResult> {
  const parsed = changePinSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'PIN invalid.',
    };
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
    return { success: false, error: 'Doar elevii pot schimba PIN-ul aici.' };
  }

  const { data: student } = await supabase
    .from('students')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();
  if (!student?.username || !user.email) {
    return { success: false, error: 'Nu am putut găsi contul tău. Anunță profesorul.' };
  }

  // Mirror the auth rate-limit identifier used by student-login so a brute-force
  // attempt on the change-PIN flow shares the same 5/15-min window.
  const rateLimitKey = `student:${student.username}`;
  const rateLimit = await checkLoginRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Prea multe încercări. Încearcă din nou în ${rateLimit.retryAfterMinutes} minute.`,
    };
  }

  // Verify the current PIN by re-authenticating with a scoped client. The
  // student-login flow keeps the child-facing PIN but derives a longer
  // Supabase Auth password at the auth boundary — re-auth ensures we never
  // trust client-supplied "currentPin" without proving it.
  const reauth = await supabase.auth.signInWithPassword({
    email: user.email,
    password: studentPinToAuthPassword(parsed.data.currentPin),
  });

  if (reauth.error) {
    await recordFailedLogin(rateLimitKey);
    return { success: false, error: 'PIN-ul actual este greșit.' };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: studentPinToAuthPassword(parsed.data.newPin),
  });

  if (updateError) {
    return {
      success: false,
      error: 'Nu am putut schimba PIN-ul. Încearcă din nou mai târziu.',
    };
  }

  await clearLoginAttempts(rateLimitKey);
  return { success: true };
}
