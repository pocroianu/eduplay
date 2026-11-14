import {
  ApiError,
  camelCaseKeys,
  handleRoute,
  parseQuery,
  parseRows,
  requireRole,
  success,
} from '@/lib/api';
import { decodeCursor, encodeCursor } from '@/lib/api/cursor';
import {
  adminUserListRowSchema,
  listAdminUsersQuerySchema,
} from '@/features/admin/api/schemas';

// ---------------------------------------------------------------------------
// GET /api/v1/admin/users — list profiles with cursor pagination
// ---------------------------------------------------------------------------
export const GET = handleRoute(async (req) => {
  const { supabase } = await requireRole('admin');
  const url = new URL(req.url);
  const filters = parseQuery(url.searchParams, listAdminUsersQuerySchema);

  const fetchLimit = filters.limit + 1;

  let query = supabase
    .from('profiles')
    .select('id, email, full_name, role, status, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit);

  if (filters.role) query = query.eq('role', filters.role);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.q) {
    const escaped = filters.q.replace(/[%_]/g, '\\$&');
    query = query.or(
      `full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`,
    );
  }
  if (filters.cursor) {
    const decoded = decodeCursor(filters.cursor);
    if (!decoded) throw ApiError.validation('Invalid cursor');
    query = query.or(
      `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);

  const rows = data ?? [];
  const hasMore = rows.length > filters.limit;
  const page = hasMore ? rows.slice(0, filters.limit) : rows;
  const last = page.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.created_at as string, id: String(last.id) })
      : null;

  const parsed = parseRows(
    page.map((row) => camelCaseKeys(row)),
    adminUserListRowSchema,
    'GET /api/v1/admin/users',
  );

  return success(parsed, 200, { nextCursor });
});
