import {
  ApiError,
  camelCaseKeys,
  created,
  handleRoute,
  parseRow,
  requireRole,
} from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/server';
import { recordAdminAction } from '@/lib/admin/audit';
import { deletionRequestRowSchema } from '@/features/admin/api/schemas';
import { z } from 'zod';

interface UserContext {
  params: Promise<{ id: string }>;
}

const userIdSchema = z.string().uuid('Invalid user id');

// ---------------------------------------------------------------------------
// POST /api/v1/admin/users/:id/initiate-deletion
//
// Inserts a deletion_requests row on behalf of the user. RLS today restricts
// inserts to `user_id = auth.uid()`, so we use the service-role client.
// Admins cannot initiate deletion of themselves (see EDU-22 self-delete flow).
// ---------------------------------------------------------------------------
export const POST = handleRoute(async (_req, context) => {
  const { supabase, user } = await requireRole('admin');
  const { id } = await (context as UserContext).params;
  const userId = userIdSchema.parse(id);

  if (userId === user.id) {
    throw ApiError.validation(
      'Admins cannot initiate deletion for themselves; use the standard self-deletion flow.',
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw new ApiError('INTERNAL_ERROR', profileError.message);
  if (!profile) throw ApiError.notFound('User');

  const adminClient = createAdminClient();

  const { data: existing } = await adminClient
    .from('deletion_requests')
    .select('id, status, scheduled_deletion_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    throw new ApiError(
      'CONFLICT',
      'User already has a pending deletion request',
    );
  }

  const { data: row, error: insertError } = await adminClient
    .from('deletion_requests')
    .insert({
      user_id: userId,
      reason: `Admin-initiated by ${user.id}`,
    })
    .select()
    .single();

  if (insertError || !row) {
    throw new ApiError(
      'INTERNAL_ERROR',
      insertError?.message ?? 'Failed to create deletion request',
    );
  }

  await recordAdminAction({
    actorId: user.id,
    action: 'user_deletion_initiated',
    resourceType: 'deletion_requests',
    resourceId: row.id,
    before: null,
    after: row,
  });

  return created(
    parseRow(
      camelCaseKeys(row),
      deletionRequestRowSchema,
      'POST /api/v1/admin/users/:id/initiate-deletion',
    ),
  );
});
