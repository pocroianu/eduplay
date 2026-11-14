import { NextResponse } from 'next/server';
import { ApiError, handleRoute, parseQuery, requireRole } from '@/lib/api';
import { scrubSecrets } from '@/lib/admin/audit';
import {
  ADMIN_AUDIT_CSV_ROW_LIMIT,
  listAdminAuditQuerySchema,
} from '@/features/admin/api/schemas';

const CSV_HEADER = [
  'id',
  'changed_at',
  'actor_id',
  'action',
  'resource_type',
  'resource_id',
  'visibility',
  'before',
  'after',
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text =
    typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// ---------------------------------------------------------------------------
// GET /api/v1/admin/audit/export.csv
//
// Streams CSV with a hard cap of 10,000 rows. Overflow returns 413 with a
// Romanian error body. Secret-shaped keys in `before`/`after` are scrubbed
// recursively.
// ---------------------------------------------------------------------------
export const GET = handleRoute(async (req) => {
  const { supabase } = await requireRole('admin');
  const url = new URL(req.url);
  // The CSV exporter ignores `cursor`/`limit` from the schema and uses the
  // hard-cap row limit instead, but reuses every other filter.
  const filters = parseQuery(url.searchParams, listAdminAuditQuerySchema);

  const overflowProbe = ADMIN_AUDIT_CSV_ROW_LIMIT + 1;

  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('changed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(overflowProbe);

  if (filters.from) query = query.gte('changed_at', filters.from);
  if (filters.to) query = query.lte('changed_at', filters.to);
  if (filters.actor) query = query.eq('changed_by', filters.actor);
  if (filters.action) query = query.eq('action', filters.action);
  if (filters.resourceType) query = query.eq('table_name', filters.resourceType);

  const { data, error } = await query;
  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  const rows = data ?? [];
  if (rows.length > ADMIN_AUDIT_CSV_ROW_LIMIT) {
    // Spec: return 413 with raw body — bypasses the standard ApiResponse
    // envelope per EDU-48 §11.
    return NextResponse.json(
      { error: 'limit_exceeded', limit: ADMIN_AUDIT_CSV_ROW_LIMIT },
      { status: 413 },
    );
  }

  const lines: string[] = [CSV_HEADER.join(',')];
  for (const row of rows) {
    const before = row.old_data === null || row.old_data === undefined
      ? null
      : scrubSecrets(row.old_data);
    const after = row.new_data === null || row.new_data === undefined
      ? null
      : scrubSecrets(row.new_data);

    lines.push(
      [
        csvEscape(row.id),
        csvEscape(row.changed_at),
        csvEscape(row.changed_by),
        csvEscape(row.action),
        csvEscape(row.table_name),
        csvEscape(row.resource_id_text ?? row.record_id ?? null),
        csvEscape(row.visibility),
        csvEscape(before),
        csvEscape(after),
      ].join(','),
    );
  }

  const body = lines.join('\n');
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="audit-export-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
});
