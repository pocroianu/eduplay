'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { resetPasswordSchema } from '../schemas/reset-password.schema';
import { ROUTES } from '@/shared/lib/constants/routes';
import { redirect } from 'next/navigation';

export interface ResetPasswordResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

/**
 * Server Action: Reset user password with a new password.
 *
 * Flow:
 * 1. Validate password with Zod (strength requirements + matching)
 * 2. Update password via Supabase Auth
 * 3. Invalidate all other sessions (security)
 * 4. Determine redirect based on user role
 * 5. Redirect to appropriate dashboard (user is auto-logged in)
 *
 * Note: Supabase handles token verification. When the user clicks the
 * reset link, Supabase verifies the token and creates a session.
 * By the time this action runs, the user already has an authenticated session.
 */
export async function resetPassword(
  formData: FormData
): Promise<ResetPasswordResult> {
  // 1. Validate password
  const result = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  const { password } = result.data;

  // 2. Update password via Supabase
  const supabase = await createClient();
  const { data, error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    console.error('Password update error:', error.message);

    // Provide user-friendly error messages
    if (error.message.includes('expired') || error.message.includes('invalid')) {
      return {
        success: false,
        error: 'Link-ul de resetare a expirat sau este invalid. Te rugăm să soliciți un link nou.',
      };
    }

    return {
      success: false,
      error: 'Nu am putut reseta parola. Te rugăm să încerci din nou.',
    };
  }

  // 3. Invalidate other sessions (security best practice)
  if (data.user) {
    try {
      const adminClient = createAdminClient();
      // Sign out all other sessions for this user
      await adminClient.auth.admin.signOut(data.user.id, 'others');
    } catch (sessionError) {
      // Log but don't block user flow - session invalidation is best-effort
      console.error('Session invalidation error:', sessionError);
    }
  }

  // 4. Determine redirect based on user role
  let redirectUrl: string = ROUTES.TEACHER.DASHBOARD; // Default to teacher dashboard

  if (data.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profile?.role === 'parent') {
      redirectUrl = ROUTES.PARENT.DASHBOARD;
    } else if (profile?.role === 'admin') {
      redirectUrl = ROUTES.ADMIN.DASHBOARD;
    }
  }

  // 5. Redirect to dashboard (user is auto-logged in via Supabase session)
  redirect(redirectUrl);
}
