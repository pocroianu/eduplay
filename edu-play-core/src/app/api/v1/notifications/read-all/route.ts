import {
  handleRoute,
  requireRole,
  noContent,
  ApiError,
} from '@/lib/api';

export const POST = handleRoute(async () => {
  const ctx = await requireRole('parent');

  const { error } = await ctx.supabase
    .from('parent_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('parent_id', ctx.user.id)
    .is('read_at', null);

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  return noContent();
});
