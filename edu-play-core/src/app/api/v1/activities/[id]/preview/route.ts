import {
  ApiError,
  handleRoute,
  parseBody,
  requireRole,
  success,
} from '@/lib/api';
import { previewActivitySchema } from '@/features/api';
import {
  cleanupExpiredPreviewSessions,
  createPreviewSession,
  getActivityOrThrow,
  validateConfigForType,
} from '@/features/activities/server';

export const POST = handleRoute(async (req, context) => {
  const { supabase, user, profile } = await requireRole('admin', 'teacher');
  const { id } = await context!.params;
  const body = await parseBody(req, previewActivitySchema);
  const activity = await getActivityOrThrow(supabase, id);
  const typeId = body.typeId ?? activity.template;

  if (profile.role === 'teacher') {
    if (activity.createdBy !== user.id || activity.visibilityScope !== 'private') {
      throw ApiError.notFound('Activity');
    }

    if (typeId !== activity.template) {
      throw ApiError.forbidden('Teachers can only preview the activity draft type');
    }
  }

  const activityType = await validateConfigForType(
    supabase,
    typeId,
    body.configData,
    'POST /api/v1/activities/[id]/preview',
  );

  if (profile.role === 'teacher' && activityType.authoringMode !== 'teacher-simple') {
    throw ApiError.forbidden('Teachers can only preview teacher-authorable activities');
  }

  await cleanupExpiredPreviewSessions();

  return success(await createPreviewSession(supabase, {
    activityId: id,
    typeId,
    configData: body.configData,
    createdBy: user.id,
  }));
});
