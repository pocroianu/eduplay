'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { forgotPasswordSchema } from '../schemas/forgot-password.schema';
import { checkRateLimit, logResetRequest } from '../server';

const RESET_LINK_ERROR = 'Nu am putut trimite linkul acum. Te rugăm să încerci din nou.';

export interface RequestPasswordResetResult {
  success: boolean;
  error?: string;
}

function getResetBaseUrl(origin: string | null): string | null {
  return (process.env.NEXT_PUBLIC_APP_URL || origin)?.replace(/\/$/, '') ?? null;
}

export async function requestPasswordReset(
  formData: FormData
): Promise<RequestPasswordResetResult> {
  const result = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  });

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  const { email } = result.data;

  const rateLimit = await checkRateLimit(email);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Prea multe încercări de resetare. Te rugăm să încerci din nou în ${rateLimit.remainingTime} minute.`,
    };
  }

  const appUrl = getResetBaseUrl((await headers()).get('origin'));
  if (!appUrl) {
    console.error('Password reset request error: missing app URL');
    return { success: false, error: RESET_LINK_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/reset-password`,
  });

  await logResetRequest(email);

  if (error) {
    console.error('Password reset request error:', error.message);
  }

  return { success: true };
}
