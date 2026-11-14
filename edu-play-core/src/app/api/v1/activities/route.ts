import {
  handleRoute,
  requireAuth,
  requireRole,
  parseBody,
  parseQuery,
  paginated,
  created,
  parsePagination,
  toRange,
  buildMeta,
  camelCaseKeys,
  ApiError,
} from '@/lib/api';
import {
  createActivitySchema,
  listActivitiesQuerySchema,
} from '@/features/api';
import {
  getActivityTypeOrThrow,
  snakeCaseColumns,
  validateConfigForType,
} from '@/features/activities/server';

export const GET = handleRoute(async (req) => {
  const ctx = await requireAuth();
  const searchParams = new URL(req.url).searchParams;
  const query = parseQuery(searchParams, listActivitiesQuerySchema);
  const pagination = parsePagination(searchParams);
  const { from, to } = toRange(pagination);

  let qb = ctx.supabase
    .from('activities')
    .select('*', { count: 'exact' });

  const isAdmin = ctx.profile.role === 'admin';
  const isTeacher = ctx.profile.role === 'teacher';
  if (isAdmin) {
    if (query.published !== undefined) {
      qb = qb.eq('is_published', query.published === 'true');
    }
  } else if (isTeacher) {
    qb = qb.or(
      `and(visibility_scope.eq.public,status.eq.published,is_published.eq.true),and(visibility_scope.eq.private,created_by.eq.${ctx.user.id})`,
    );
  } else {
    qb = qb
      .eq('visibility_scope', 'public')
      .eq('status', 'published')
      .eq('is_published', true);
  }

  if (query.visibilityScope) {
    qb = qb.eq('visibility_scope', query.visibilityScope);
  }

  const typeFilter = query.typeId ?? query.template;
  if (typeFilter) {
    qb = qb.eq('template', typeFilter);
  }
  if (query.status) {
    qb = qb.eq('status', query.status);
  }
  if (query.category) {
    qb = qb.eq('category', query.category);
  }
  if (query.difficulty) {
    qb = qb.eq('difficulty', query.difficulty);
  }
  if (query.subject) {
    qb = qb.eq('subject', query.subject);
  }
  if (query.search) {
    qb = qb.ilike('title', `%${query.search}%`);
  }
  if (query.tag) {
    qb = qb.contains('tags', [query.tag]);
  }

  qb = qb.order('created_at', { ascending: false }).range(from, to);

  const { data, count, error } = await qb;
  if (error) throw error;

  const rows = (data ?? []).map(camelCaseKeys);
  const meta = buildMeta(pagination, count ?? 0);

  return paginated(rows, meta);
});

export const POST = handleRoute(async (req) => {
  const ctx = await requireRole('admin', 'teacher');
  const body = await parseBody(req, createActivitySchema);
  const typeId = body.typeId ?? body.template;

  if (body.status === 'published' || body.isPublished === true) {
    throw new ApiError('CONFLICT', 'Use the publish endpoint to publish activities');
  }

  if (!typeId) {
    throw ApiError.validation('Activity type is required');
  }

  const activityType = body.configData === undefined
    ? await getActivityTypeOrThrow(ctx.supabase, typeId)
    : await validateConfigForType(
        ctx.supabase,
        typeId,
        body.configData,
        'POST /api/v1/activities',
      );

  if (ctx.profile.role === 'teacher' && activityType.authoringMode !== 'teacher-simple') {
    throw ApiError.forbidden('Teachers can only create teacher-authorable activities');
  }

  if (ctx.profile.role === 'teacher' && body.visibilityScope && body.visibilityScope !== 'private') {
    throw ApiError.forbidden('Teachers can only create private activities');
  }

  const {
    typeId: _typeId,
    configData,
    configSchemaVersion: _configSchemaVersion,
    revertVersionId: _revertVersionId,
    visibilityScope: _visibilityScope,
    ...rest
  } = body;

  const visibilityScope =
    ctx.profile.role === 'teacher'
      ? 'private'
      : body.visibilityScope ?? 'public';

  const record = {
    ...snakeCaseColumns({
      ...rest,
      template: typeId,
      visibilityScope,
      ...(configData !== undefined && {
        configData,
        configSchemaVersion: activityType?.version,
      }),
    }),
    created_by: ctx.user.id,
  };

  const { data, error } = await ctx.supabase
    .from('activities')
    .insert(record)
    .select()
    .single();

  if (error) throw error;

  return created(camelCaseKeys(data));
});
