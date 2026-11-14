import {
  handleRoute,
  requireRole,
  parseQuery,
  paginated,
  parsePagination,
  toRange,
  buildMeta,
  camelCaseKeys,
  parseRows,
  ApiError,
} from '@/lib/api';
import {
  listAuditLogQuerySchema,
  auditLogRowSchema,
} from '@/features/api/schemas/audit-log.schema';

// ---------------------------------------------------------------------------
// GET /api/v1/audit-log — list audit log entries (admin + teacher)
// ---------------------------------------------------------------------------
export const GET = handleRoute(async (req) => {
  const { supabase } = await requireRole('admin', 'teacher');
  const url = new URL(req.url);
  const filters = parseQuery(url.searchParams, listAuditLogQuerySchema);
  const pagination = parsePagination(url.searchParams);
  const { from, to } = toRange(pagination);

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.action) {
    query = query.eq('action', filters.action);
  }

  if (filters.artifactId) {
    query = query.eq('artifact_id', filters.artifactId);
  }

  if (filters.actorId) {
    query = query.eq('actor_id', filters.actorId);
  }

  if (filters.from) {
    query = query.gte('created_at', filters.from);
  }

  if (filters.to) {
    query = query.lte('created_at', filters.to);
  }

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  const rows = parseRows(
    (data ?? []).map(camelCaseKeys),
    auditLogRowSchema,
    'GET /api/v1/audit-log',
  );
  return paginated(rows, buildMeta(pagination, count ?? 0));
});
