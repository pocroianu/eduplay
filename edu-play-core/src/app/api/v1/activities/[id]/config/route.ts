import { ApiError, handleRoute, rawJson, requireAuth } from '@/lib/api';
import { resolveActivityLaunch } from '@/features/activities/server';
import { createAdminClient } from '@/lib/supabase/server';

export const GET = handleRoute(async (req, context) => {
  const { supabase } = await requireAuth();
  const { id } = await context!.params;
  const searchParams = new URL(req.url).searchParams;
  const versionId = searchParams.get('versionId');
  const assignmentId = searchParams.get('assignmentId');

  if (!versionId) {
    throw ApiError.validation('Activity config versionId is required');
  }

  const snapshot = await resolveActivityLaunch(
    supabase,
    createAdminClient,
    id,
    {
      mode: 'published',
      versionId,
      assignmentId: assignmentId ?? undefined,
    },
  );

  return rawJson(snapshot.config, {
    headers: { 'Cache-Control': 'no-store' },
  });
});
