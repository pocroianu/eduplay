'use server';

import { createClient } from '@/lib/supabase/server';
import { studentLoginSchema } from '../schemas/student-login.schema';
import { ROUTES } from '@/shared/lib/constants';
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  recordFailedLogin,
} from '../utils/login-rate-limit';
import { studentPinToAuthPassword } from '../utils/student-auth-password';
import { STUDENT_LOGIN_RATE_LIMITED_CODE } from '../utils/student-login-errors';

const STUDENT_EMAIL_DOMAIN = 'student.eduplay.ro';

export interface StudentLoginSuccess {
  ok: true;
  redirectTo: string;
}

export async function studentLogin(formData: FormData): Promise<StudentLoginSuccess> {
  const supabase = await createClient();

  const validated = studentLoginSchema.parse({
    username: formData.get('username'),
    pin: formData.get('pin'),
  });

  const rateLimitKey = `student:${validated.username}`;
  const rateLimit = await checkLoginRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    throw new Error(
      `${STUDENT_LOGIN_RATE_LIMITED_CODE}:${rateLimit.retryAfterMinutes}`,
    );
  }

  const email = `${validated.username}@${STUDENT_EMAIL_DOMAIN}`;

  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password: studentPinToAuthPassword(validated.pin),
  });

  if (error) {
    await recordFailedLogin(rateLimitKey);
    throw new Error('Nume de utilizator sau PIN greșit');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (!profile || profile.role !== 'student') {
    await supabase.auth.signOut();
    throw new Error('Acces interzis');
  }

  await clearLoginAttempts(rateLimitKey);
  return { ok: true, redirectTo: ROUTES.STUDENT.DASHBOARD };
}
