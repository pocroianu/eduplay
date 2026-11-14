'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { registerSchema } from '../schemas/register.schema';
import { ROUTES } from '@/shared/lib/constants';

const REGISTER_ERROR_MESSAGE = 'Nu am putut crea contul. Verifică datele și încearcă din nou.';

export async function register(formData: FormData) {
  const supabase = await createClient();

  const validated = registerSchema.parse({
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    fullName: formData.get('fullName'),
    role: 'teacher',
  });

  const { error, data } = await supabase.auth.signUp({
    email: validated.email,
    password: validated.password,
    options: {
      data: {
        full_name: validated.fullName,
        role: validated.role,
      },
    },
  });

  if (error || !data.user) {
    throw new Error(REGISTER_ERROR_MESSAGE);
  }

  redirect(ROUTES.TEACHER.DASHBOARD);
}
