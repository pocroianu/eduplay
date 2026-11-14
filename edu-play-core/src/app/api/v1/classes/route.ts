import {
  handleRoute,
  requireRole,
  parsePagination,
  toRange,
  buildMeta,
  parseBody,
  parseRow,
  parseRows,

  created,
  paginated,
  camelCaseKeys,
  snakeCaseKeys,
  ApiError,
} from '@/lib/api';
import {
  classRowSchema,
  createClassSchema,
} from '@/features/api/schemas/class.schema';

/* ------------------------------------------------------------------ */
/*  GET /api/v1/classes — list teacher's classes (paginated)           */
/* ------------------------------------------------------------------ */

export const GET = handleRoute(async (req) => {
  const ctx = await requireRole('teacher');
  const { searchParams } = new URL(req.url);
  const pagination = parsePagination(searchParams);
  const { from, to } = toRange(pagination);

  const { data, error, count } = await ctx.supabase
    .from('classes')
    .select('*', { count: 'exact' })
    .eq('teacher_id', ctx.user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  const rows = parseRows(
    (data ?? []).map(camelCaseKeys),
    classRowSchema,
    'GET /api/v1/classes',
  );

  const meta = buildMeta(pagination, count ?? 0);
  return paginated(rows, meta);
});

/* ------------------------------------------------------------------ */
/*  POST /api/v1/classes — create a new class                         */
/* ------------------------------------------------------------------ */

export const POST = handleRoute(async (req) => {
  const ctx = await requireRole('teacher');
  const body = await parseBody(req, createClassSchema);

  const { data, error } = await ctx.supabase
    .from('classes')
    .insert({ teacher_id: ctx.user.id, ...snakeCaseKeys<Record<string, unknown>>(body) })
    .select()
    .single();

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  const row = parseRow(camelCaseKeys(data), classRowSchema, 'POST /api/v1/classes');
  return created(row);
});
