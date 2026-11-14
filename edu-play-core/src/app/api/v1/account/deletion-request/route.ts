import {
  handleRoute,
  requireAuth,
  requireRole,
  parseBody,
  success,
  created,
  noContent,
  ApiError,
  camelCaseKeys,
} from '@/lib/api';
import { createDeletionRequestSchema } from '@/features/api/schemas/deletion-request.schema';

/* ------------------------------------------------------------------ */
/*  POST /api/v1/account/deletion-request                             */
/*  GDPR Art.17 — request account deletion with 30-day grace period.  */
/*  Students cannot self-delete (teacher/admin manages).              */
/* ------------------------------------------------------------------ */

export const POST = handleRoute(async (req) => {
  const ctx = await requireRole('teacher', 'parent', 'admin');
  const body = await parseBody(req, createDeletionRequestSchema);

  const { data: existing } = await ctx.supabase
    .from('deletion_requests')
    .select('id, status, scheduled_deletion_at')
    .eq('user_id', ctx.user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    throw new ApiError('CONFLICT', 'A pending deletion request already exists');
  }

  const { data, error } = await ctx.supabase
    .from('deletion_requests')
    .insert({
      user_id: ctx.user.id,
      reason: body.reason ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  return created(camelCaseKeys(data));
});

/* ------------------------------------------------------------------ */
/*  GET /api/v1/account/deletion-request                              */
/*  Check the current user's most recent deletion request status.     */
/* ------------------------------------------------------------------ */

export const GET = handleRoute(async () => {
  const ctx = await requireAuth();

  const { data, error } = await ctx.supabase
    .from('deletion_requests')
    .select('*')
    .eq('user_id', ctx.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  return success(data ? camelCaseKeys(data) : null);
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/v1/account/deletion-request                           */
/*  Cancel a pending deletion request within the 30-day window.       */
/* ------------------------------------------------------------------ */

export const DELETE = handleRoute(async () => {
  const ctx = await requireAuth();

  const { data: pending } = await ctx.supabase
    .from('deletion_requests')
    .select('id')
    .eq('user_id', ctx.user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!pending) {
    throw ApiError.notFound('Pending deletion request');
  }

  const { error } = await ctx.supabase
    .from('deletion_requests')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', pending.id);

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  return noContent();
});
