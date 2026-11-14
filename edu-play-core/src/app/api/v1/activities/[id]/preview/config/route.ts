import { handleRoute, rawJson, requireRole } from '@/lib/api';
import { getPreviewSessionOrThrow } from '@/features/activities/server';

export const GET = handleRoute(async (req, context) => {
  const { supabase, user } = await requireRole('admin', 'teacher');
  const { id } = await context!.params;
  const previewId = new URL(req.url).searchParams.get('previewId') ?? undefined;
  const session = await getPreviewSessionOrThrow(supabase, {
    previewId,
    activityId: id,
    actorId: user.id,
  });

  return rawJson(session.configData, {
    headers: { 'Cache-Control': 'no-store' },
  });
});
