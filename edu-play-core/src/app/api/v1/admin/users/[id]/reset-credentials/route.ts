import {
  ApiError,
  handleRoute,
  parseRow,
  requireRole,
  success,
} from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/server';
import { studentPinToAuthPassword } from '@/features/auth/server';
import { recordAdminAction } from '@/lib/admin/audit';
import { resetCredentialsResponseSchema } from '@/features/admin/server';
import { z } from 'zod';

interface UserContext {
  params: Promise<{ id: string }>;
}

const userIdSchema = z.string().uuid('Invalid user id');

function generateRandomPin(): string {
  // 4-digit PIN, zero-padded. crypto.getRandomValues is fine for the
  // operational reset flow — student PINs are guarded by 5-attempt
  // rate limiting (see CLAUDE.md "Rate Limiting").
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 10_000).padStart(4, '0');
}

// ---------------------------------------------------------------------------
// POST /api/v1/admin/users/:id/reset-credentials
//
// Teacher / parent → triggers Supabase password-reset email.
// Student         → rotates PIN via auth admin API; PIN returned exactly once.
// ---------------------------------------------------------------------------
export const POST = handleRoute(async (_req, context) => {
  const { supabase, user } = await requireRole('admin');
  const { id } = await (context as UserContext).params;
  const userId = userIdSchema.parse(id);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw new ApiError('INTERNAL_ERROR', profileError.message);
  if (!profile) throw ApiError.notFound('User');

  const adminClient = createAdminClient();

  if (profile.role === 'student') {
    const newPin = generateRandomPin();
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: studentPinToAuthPassword(newPin) },
    );
    if (updateError) {
      throw new ApiError('INTERNAL_ERROR', updateError.message);
    }

    await recordAdminAction({
      actorId: user.id,
      action: 'student_pin_reset',
      resourceType: 'profiles',
      resourceId: userId,
      // Never log the new PIN value — only that a reset happened.
      before: null,
      after: { rotated: true },
    });

    return success(
      parseRow(
        { channel: 'pin', pin: newPin },
        resetCredentialsResponseSchema,
        'POST /api/v1/admin/users/:id/reset-credentials (pin)',
      ),
    );
  }

  if (!profile.email) {
    throw new ApiError('CONFLICT', 'User has no email on file');
  }

  const { error: resetError } = await adminClient.auth.resetPasswordForEmail(
    profile.email,
  );
  if (resetError) {
    throw new ApiError('INTERNAL_ERROR', resetError.message);
  }

  await recordAdminAction({
    actorId: user.id,
    action: 'password_reset_requested',
    resourceType: 'profiles',
    resourceId: userId,
    before: null,
    after: { email: profile.email },
  });

  return success(
    parseRow(
      { channel: 'email', emailSentTo: profile.email },
      resetCredentialsResponseSchema,
      'POST /api/v1/admin/users/:id/reset-credentials (email)',
    ),
  );
});
