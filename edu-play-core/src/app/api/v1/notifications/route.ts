import {
  handleRoute,
  requireRole,
  parsePagination,
  toRange,
  buildMeta,
  paginated,
  camelCaseKeys,
  parseRows,
  ApiError,
} from '@/lib/api';
import { notificationRowSchema } from '@/features/api/schemas/notification.schema';

export const GET = handleRoute(async (req) => {
  const ctx = await requireRole('parent');
  const { searchParams } = new URL(req.url);
  const pagination = parsePagination(searchParams);
  const { from, to } = toRange(pagination);

  const { data, error, count } = await ctx.supabase
    .from('parent_notifications')
    .select(
      '*, students:student_id (id, username, avatar_url)',
      { count: 'exact' },
    )
    .eq('parent_id', ctx.user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  const meta = buildMeta(pagination, count ?? 0);
  const rows = parseRows(
    (data ?? []).map(camelCaseKeys),
    notificationRowSchema,
    'GET /api/v1/notifications',
  );
  return paginated(rows, meta);
});
