import {
  ApiError,
  buildMeta,
  created,
  handleRoute,
  paginated,
  parseBody,
  parsePagination,
  requireRole,
  toRange,
} from '@/lib/api';
import { createActivityVersionSchema } from '@/features/api';
import {
  getActivityOrThrow,
  parseActivityVersionRowFromDb,
  validateConfigForType,
} from '@/features/activities/server';
import { createAdminClient } from '@/lib/supabase/server';

export const GET = handleRoute(async (req, context) => {
  const { supabase } = await requireRole('admin');
  const { id } = await context!.params;
  const url = new URL(req.url);
  const pagination = parsePagination(url.searchParams);
  const { from, to } = toRange(pagination);

  const { data, count, error } = await supabase
    .from('activity_versions')
    .select('*', { count: 'exact' })
    .eq('activity_id', id)
    .order('version_number', { ascending: false })
    .range(from, to);

  if (error) throw error;

  const rows = (data ?? []).map((row) =>
    parseActivityVersionRowFromDb(
      row,
      'GET /api/v1/activities/[id]/versions',
    ),
  );

  return paginated(rows, buildMeta(pagination, count ?? rows.length));
});

export const POST = handleRoute(async (req, context) => {
  const { supabase, user } = await requireRole('admin');
  const { id } = await context!.params;
  const body = await parseBody(req, createActivityVersionSchema);

  const activity = await getActivityOrThrow(supabase, id);
  if (activity.status !== 'draft' || activity.isPublished === true) {
    throw new ApiError(
      'CONFLICT',
      'Standalone versions can only be created for unpublished drafts',
    );
  }

  const activityType = await validateConfigForType(
    supabase,
    activity.template,
    body.configData,
    'POST /api/v1/activities/[id]/versions',
  );

  if (!activity.configSchemaVersion && !activityType.version) {
    throw ApiError.validation('Activity type schema version is missing');
  }

  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase.rpc('create_activity_version_atomically', {
    p_activity_id: id,
    p_activity_type_id: activity.template,
    p_config_data: body.configData,
    p_config_schema_version: activityType.version,
    p_actor_id: user.id,
  });

  if (error) {
    if (error.code === '23514' || error.code === '40001') {
      throw new ApiError(
        'CONFLICT',
        'Standalone versions can only be created for unpublished drafts',
      );
    }
    throw error;
  }

  if (!data) {
    throw new Error('create_activity_version_atomically returned no data');
  }

  const version = parseActivityVersionRowFromDb(
    data,
    'create_activity_version_atomically version',
  );

  return created(version);
});
