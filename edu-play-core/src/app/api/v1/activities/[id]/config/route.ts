import {
  ApiError,
  handleRoute,
  rawJson,
  requireAuth,
} from '@/lib/api';
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

  type AssignmentAuthRow = { activity_id?: string | null; version_id?: string | null; teacher_id?: string | null };
  let assignment: AssignmentAuthRow | null = null;

  if (assignmentId) {
    const { data, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, activity_id, version_id, teacher_id')
      .eq('id', assignmentId)
      .single();

    assignment = data as AssignmentAuthRow | null;

    if (
      assignmentError ||
      !assignment ||
      assignment.activity_id !== id ||
      assignment.version_id !== versionId
    ) {
      throw ApiError.notFound('Activity config');
    }
  } else {
    const { data, error } = await supabase
      .from('activities')
      .select('id')
      .eq('id', id)
      .eq('is_published', true)
      .single();

    if (error || !data) {
      throw ApiError.notFound('Activity config');
    }
  }

  const adminSupabase = createAdminClient();
  const { data: activity, error: activityError } = await adminSupabase
    .from('activities')
    .select('id, visibility_scope, created_by, status, is_published')
    .eq('id', id)
    .eq('is_published', true)
    .single();

  if (activityError || !activity) {
    throw ApiError.notFound('Activity config');
  }

  if (
    assignment &&
    (activity as { visibility_scope?: string | null; created_by?: string | null }).visibility_scope === 'private' &&
    assignment.teacher_id !== (activity as { created_by?: string | null }).created_by
  ) {
    throw ApiError.notFound('Activity config');
  }

  const { data: version, error: versionError } = await adminSupabase
    .from('activity_versions')
    .select('id, activity_id, version_number, config_data')
    .eq('activity_id', id)
    .eq('id', versionId)
    .single();

  if (versionError || !version) {
    throw ApiError.notFound('Activity config');
  }

  if (!assignmentId) {
    const { data: latest, error: latestError } = await adminSupabase
      .from('activity_versions')
      .select('id')
      .eq('activity_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    if (
      latestError ||
      !latest ||
      (latest as { id: string }).id !== versionId
    ) {
      throw ApiError.notFound('Activity config');
    }
  }

  return rawJson(version.config_data ?? {}, {
    headers: { 'Cache-Control': 'no-store' },
  });
});
