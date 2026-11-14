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
  auditLogRowSchema,
  listAdminAuditQuerySchema,
} from '@/features/admin/api/schemas';

// ---------------------------------------------------------------------------
// GET /api/v1/admin/audit — list audit_logs rows with cursor pagination
// ---------------------------------------------------------------------------
export const GET = handleRoute(async (req) => {
  const { supabase } = await requireRole('admin');
  const url = new URL(req.url);
  const filters = parseQuery(url.searchParams, listAdminAuditQuerySchema);

  // We over-fetch by 1 to know whether a `nextCursor` should be returned.
  const fetchLimit = filters.limit + 1;

  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('changed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit);

  if (filters.from) {
    query = query.gte('changed_at', filters.from);
  }
  if (filters.to) {
    query = query.lte('changed_at', filters.to);
  }
  if (filters.actor) {
    query = query.eq('changed_by', filters.actor);
  }
  if (filters.action) {
    query = query.eq('action', filters.action);
  }
  if (filters.resourceType) {
    query = query.eq('table_name', filters.resourceType);
  }

  if (filters.cursor) {
    const decoded = decodeCursor(filters.cursor);
    if (!decoded) {
      throw ApiError.validation('Invalid cursor');
    }
    // Keyset: prior page ended at (createdAt, id), so this page is everything
    // strictly older. Postgres tuple comparison via .or() chain.
    query = query.or(
      `changed_at.lt.${decoded.createdAt},and(changed_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  const rows = data ?? [];
  const hasMore = rows.length > filters.limit;
  const page = hasMore ? rows.slice(0, filters.limit) : rows;
  const last = page.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.changed_at as string, id: String(last.id) })
      : null;

  // Validate raw audit_logs rows (camelCased) before transforming into the
  // admin audit entry shape. Drift surfaces as 500 with structured logs.
  const parsedRows = parseRows(
    page.map((row) => camelCaseKeys(row)),
    auditLogRowSchema,
    'GET /api/v1/admin/audit',
  );

  return success(
    parsedRows.map((row) => ({
      id: row.id,
      actorId: row.changedBy,
      action: row.action,
      resourceType: row.tableName,
      resourceId: row.resourceIdText ?? row.recordId ?? null,
      before: row.oldData ?? null,
      after: row.newData ?? null,
      visibility: row.visibility,
      createdAt: row.changedAt,
    })),
    200,
    { nextCursor },
  );
});
