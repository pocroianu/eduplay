import {
  ApiError,
  buildMeta,
  camelCaseKeys,
  created,
  handleRoute,
  paginated,
  parseBody,
  parsePagination,
  parseQuery,
  requireRole,
  toRange,
} from '@/lib/api';
import {
  createListenTapWordListSchema,
  listListenTapWordListsQuerySchema,
} from '@/features/api/schemas/listen-tap-word-list.schema';

export const GET = handleRoute(async (req) => {
  const ctx = await requireRole('teacher');
  const { searchParams } = new URL(req.url);
  const query = parseQuery(searchParams, listListenTapWordListsQuerySchema);
  const pagination = parsePagination(searchParams);
  const { from, to } = toRange(pagination);

  let qb = ctx.supabase
    .from('listen_tap_word_lists')
    .select('*', { count: 'exact' })
    .eq('owner_teacher_id', ctx.user.id)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (query.language) {
    qb = qb.eq('language', query.language);
  }

  const { data, count, error } = await qb;
  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  const rows = (data ?? []).map(camelCaseKeys);
  return paginated(rows, buildMeta(pagination, count ?? 0));
});

export const POST = handleRoute(async (req) => {
  const ctx = await requireRole('teacher');
  const body = await parseBody(req, createListenTapWordListSchema);

  const { data, error } = await ctx.supabase
    .from('listen_tap_word_lists')
    .insert({
      owner_teacher_id: ctx.user.id,
      name: body.name,
      language: body.language,
      words: body.words,
    })
    .select()
    .single();

  if (error || !data) {
    throw new ApiError('INTERNAL_ERROR', error?.message ?? 'Failed to create word list');
  }

  return created(camelCaseKeys(data));
});
