import {
  ApiError,
  handleRoute,
  requireRole,
  success,
} from '@/lib/api';
import {
  getActivityOrThrow,
  parseActivityRowFromDb,
  parseActivityVersionRowFromDb,
  validateConfigForType,
} from '@/features/activities/server';
import { createAdminClient } from '@/lib/supabase/server';

export const POST = handleRoute(async (_req, context) => {
  const { supabase, user } = await requireRole('admin');
  const { id } = await context!.params;

  const activity = await getActivityOrThrow(supabase, id);
  if (activity.status !== 'draft') {
    throw new ApiError('CONFLICT', 'Only draft activities can be published');
  }

  if (activity.configData == null) {
    throw ApiError.validation('Activity config_data is required before publish');
  }

  const activityType = await validateConfigForType(
    supabase,
    activity.template,
    activity.configData,
    'POST /api/v1/activities/[id]/publish',
  );
  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase.rpc('publish_activity_atomically', {
    p_activity_id: id,
    p_activity_type_id: activity.template,
    p_config_data: activity.configData,
    p_config_schema_version: activityType.version,
    p_actor_id: user.id,
    p_before_status: activity.status,
    p_before_is_published: activity.isPublished ?? false,
    p_before_config_schema_version: activity.configSchemaVersion,
  });

  if (error || !data) {
    throw error ?? new Error('publish_activity_atomically returned no data');
  }

  const payload = data as {
    activity?: unknown;
    version?: unknown;
  };
  const publishedActivity = parseActivityRowFromDb(
    payload.activity,
    'publish_activity_atomically activity',
  );
  const version = parseActivityVersionRowFromDb(
    payload.version,
    'publish_activity_atomically version',
  );

  return success({
    activity: publishedActivity,
    version,
  });
});
