'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parentRegisterSchema } from '../schemas/parent-login.schema';
import { linkParentToChild } from '@/features/parent-portal/server';
import { ROUTES } from '@/shared/lib/constants';

const REGISTER_ERROR_MESSAGE = 'Nu am putut crea contul. Verifică datele și încearcă din nou.';

export async function parentRegister(formData: FormData) {
  const supabase = await createClient();

  const validated = parentRegisterSchema.parse({
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    fullName: formData.get('fullName'),
    phoneNumber: formData.get('phoneNumber') || undefined,
    inviteCode: formData.get('inviteCode') || undefined,
  });

  const { error, data } = await supabase.auth.signUp({
    email: validated.email,
    password: validated.password,
    options: {
      data: {
        full_name: validated.fullName,
        role: 'parent',
        phone_number: validated.phoneNumber,
      },
    },
  });

  if (error || !data.user) {
    throw new Error(REGISTER_ERROR_MESSAGE);
  }

  let redirectTo: string = ROUTES.PARENT.LINK_CHILD;

  if (validated.inviteCode?.length === 8) {
    try {
      const linkResult = await linkParentToChild({
        inviteCode: validated.inviteCode,
        relationshipType: 'other',
      });

      if (linkResult.success) {
        redirectTo = ROUTES.PARENT.DASHBOARD;
      } else {
        console.warn(
          `[parentRegister] Auto-link failed for user ${data.user.id}: ${linkResult.error}`
        );
      }
    } catch (linkError) {
      console.warn(
        '[parentRegister] Unexpected error during auto-link:',
        linkError
      );
    }
  }

  redirect(redirectTo);
}
