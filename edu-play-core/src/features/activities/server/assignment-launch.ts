import 'server-only';

import { createAdminClient } from '@/lib/supabase/server';

export async function attachPinnedActivityIds<
  T extends { version_id?: string | null; version?: unknown },
>(assignments: T[]): Promise<Array<T & { activity_id?: string | null }>> {
  const versionIds = [
    ...new Set(
      assignments
        .map((assignment) => assignment.version_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (versionIds.length === 0) {
    return assignments;
  }

  const { data } = await createAdminClient()
    .from('activity_versions')
    .select('id, activity_id')
    .in('id', versionIds);

  const activityIdByVersionId = new Map(
    (data ?? []).map((version) => [
      (version as { id: string }).id,
      (version as { activity_id: string | null }).activity_id,
    ]),
  );

  return assignments.map((assignment) => ({
    ...assignment,
    activity_id: assignment.version_id
      ? activityIdByVersionId.get(assignment.version_id) ?? null
      : null,
  }));
}
