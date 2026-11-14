import {
  handleRoute,
  requireRole,
  noContent,
  ApiError,
} from '@/lib/api';

export const POST = handleRoute(async (_req, context) => {
  const ctx = await requireRole('parent');
  const { id } = await context!.params;

  const { data: notification, error: fetchError } = await ctx.supabase
    .from('parent_notifications')
    .select('id, parent_id, read_at')
    .eq('id', id)
    .single();

  if (fetchError || !notification) {
    throw ApiError.notFound('Notification not found');
  }

  if (notification.parent_id !== ctx.user.id) {
    throw ApiError.forbidden();
  }

  if (notification.read_at) {
    return noContent();
  }

  const { error } = await ctx.supabase
    .from('parent_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  return noContent();
});
