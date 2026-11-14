import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ActivityVersionPin {
  activityId: string;
  versionId: string;
}

export interface ActivityAssignmentTarget extends ActivityVersionPin {
  title: string;
}

interface ResolveAssignmentOptions {
  versionClient?: SupabaseClient;
}

async function getVersionClient(options?: ResolveAssignmentOptions) {
  if (options?.versionClient) return options.versionClient;
  const { createAdminClient } = await import('@/lib/supabase/server');
  return createAdminClient();
}

export async function resolveLatestPublishedActivityAssignmentTarget(
  supabase: SupabaseClient,
  activityId: string,
  options?: ResolveAssignmentOptions,
): Promise<ActivityAssignmentTarget | null> {
  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .select('id, title')
    .eq('id', activityId)
    .eq('status', 'published')
    .eq('is_published', true)
    .maybeSingle();

  if (activityError || !activity) return null;

  const versionClient = await getVersionClient(options);
  const { data: version, error: versionError } = await versionClient
    .from('activity_versions')
    .select('id')
    .eq('activity_id', activityId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError || !version) return null;

  return {
    activityId,
    versionId: (version as { id: string }).id,
    title: (activity as { title: string }).title,
  };
}
