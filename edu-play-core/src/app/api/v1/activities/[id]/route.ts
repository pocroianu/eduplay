import {
  handleRoute,
  requireAuth,
  requireRole,
  parseBody,
  success,
  noContent,
  ApiError,
} from '@/lib/api';
import { updateActivitySchema } from '@/features/api';
import {
  getActivityOrThrow,
  getActivityTypeOrThrow,
  parseActivityRowFromDb,
  parseActivityVersionRowFromDb,
  snakeCaseColumns,
  validateConfigForType,
} from '@/features/activities/server';
import { createAdminClient } from '@/lib/supabase/server';

function canReadActivity(
  row: { created_by?: unknown; visibility_scope?: unknown; status?: unknown; is_published?: unknown },
  ctx: Awaited<ReturnType<typeof requireAuth>>,
): boolean {
  if (ctx.profile.role === 'admin') return true;

  const isPublicPublished =
    row.visibility_scope === 'public' &&
    row.status === 'published' &&
    row.is_published === true;
  if (isPublicPublished) return true;

  return (
    ctx.profile.role === 'teacher' &&
    row.visibility_scope === 'private' &&
    row.created_by === ctx.user.id
  );
}

export const GET = handleRoute(async (_req, context) => {
  const ctx = await requireAuth();
  const { id } = await context!.params;

  const { data, error } = await ctx.supabase
    .from('activities')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data || !canReadActivity(data, ctx)) {
    throw ApiError.notFound('Activity');
  }

  return success(parseActivityRowFromDb(data, 'GET /api/v1/activities/[id]'));
});

export const PATCH = handleRoute(async (req, context) => {
  const ctx = await requireRole('admin', 'teacher');
  const { id } = await context!.params;
  const body = await parseBody(req, updateActivitySchema);
  const current = await getActivityOrThrow(ctx.supabase, id);
  if (
    ctx.profile.role === 'teacher' &&
    (current.createdBy !== ctx.user.id || current.visibilityScope !== 'private')
  ) {
    throw ApiError.notFound('Activity');
  }

  if (
    ctx.profile.role === 'teacher' &&
    body.visibilityScope !== undefined &&
    body.visibilityScope !== 'private'
  ) {
    throw ApiError.forbidden('Teachers can only edit private activities');
  }

  if (
    ctx.profile.role === 'teacher' &&
    body.status !== undefined &&
    body.status !== current.status
  ) {
    throw ApiError.forbidden('Teachers cannot change activity readiness directly');
  }

  const typeId = body.typeId ?? body.template ?? current.template;
  const typeChanged = body.typeId !== undefined || body.template !== undefined;

  const {
    typeId: _typeId,
    configData,
    configSchemaVersion: _configSchemaVersion,
    revertVersionId,
    visibilityScope: _visibilityScope,
    ...rest
  } = body;
  const shouldUseAdminRevert =
    ctx.profile.role === 'admin' && revertVersionId !== undefined;

  if (!shouldUseAdminRevert && (body.status === 'published' || body.isPublished === true)) {
    throw new ApiError('CONFLICT', 'Use the publish endpoint to publish activities');
  }

  const activityType = shouldUseAdminRevert
    ? null
    : body.configData === undefined
    ? typeChanged
      ? await getActivityTypeOrThrow(ctx.supabase, typeId)
      : null
    : await validateConfigForType(
        ctx.supabase,
        typeId,
        body.configData,
        'PATCH /api/v1/activities/[id]',
      );

  if (ctx.profile.role === 'teacher' && activityType && activityType.authoringMode !== 'teacher-simple') {
    throw ApiError.forbidden('Teachers can only edit teacher-authorable activities');
  }

  if (shouldUseAdminRevert) {
    const { data: versionData, error: versionError } = await ctx.supabase
      .from('activity_versions')
      .select('*')
      .eq('id', revertVersionId)
      .eq('activity_id', id)
      .single();

    if (versionError || !versionData) {
      throw ApiError.notFound('Activity version');
    }

    const version = parseActivityVersionRowFromDb(
      versionData,
      'revert activity_versions row',
    );
    await getActivityTypeOrThrow(ctx.supabase, version.activityTypeId);

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase.rpc('revert_activity_atomically', {
      p_activity_id: id,
      p_activity_type_id: version.activityTypeId,
      p_config_data: version.configData,
      p_config_schema_version: version.configSchemaVersion,
      p_actor_id: ctx.user.id,
      p_before_status: current.status,
      p_before_is_published: current.isPublished ?? false,
      p_before_config_schema_version: current.configSchemaVersion,
    });

    if (error || !data) {
      throw error ?? new Error('revert_activity_atomically returned no data');
    }

    const payload = data as { activity?: unknown };
    return success(
      parseActivityRowFromDb(
        payload.activity,
        'revert_activity_atomically activity',
      ),
    );
  }

  const normalizedRest = { ...rest };
  if (normalizedRest.status !== undefined) {
    normalizedRest.isPublished = normalizedRest.status === 'published';
  } else if (normalizedRest.isPublished === true) {
    normalizedRest.status = 'published';
  } else if (
    normalizedRest.isPublished === false &&
    current.status === 'published'
  ) {
    normalizedRest.status = 'draft';
  }

  const record = snakeCaseColumns({
    ...normalizedRest,
    ...(body.visibilityScope !== undefined && { visibilityScope: body.visibilityScope }),
    ...(body.typeId && { template: typeId }),
    ...(configData !== undefined && {
      configData,
      configSchemaVersion: activityType?.version,
    }),
  });

  const { data, error } = await ctx.supabase
    .from('activities')
    .update(record)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    throw ApiError.notFound('Activity');
  }

  return success(parseActivityRowFromDb(data, 'PATCH /api/v1/activities/[id]'));
});

export const DELETE = handleRoute(async (_req, context) => {
  const ctx = await requireRole('admin');
  const { id } = await context!.params;

  const { error } = await ctx.supabase
    .from('activities')
    .delete()
    .eq('id', id);

  if (error) throw error;

  return noContent();
});
