import { createClient } from '@/lib/supabase/server';
import {
  camelCaseKeys,
  handleRoute,
  paginated,
  parsePagination,
  parseRows,
  toRange,
  buildMeta,
} from '@/lib/api';
import { activityTypeRowSchema } from '@/features/api';

export const GET = handleRoute(async (req) => {
  const supabase = await createClient();
  const url = new URL(req.url);
  const pagination = parsePagination(url.searchParams);
  const { from, to } = toRange(pagination);

  const { data, count, error } = await supabase
    .from('activity_types')
    .select('*', { count: 'exact' })
    .order('type_id', { ascending: true })
    .range(from, to);

  if (error) throw error;

  const rows = parseRows(
    (data ?? []).map(camelCaseKeys),
    activityTypeRowSchema,
    'GET /api/v1/activity-types',
  );

  return paginated(rows, buildMeta(pagination, count ?? rows.length));
});
