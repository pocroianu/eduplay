import {
  ApiError,
  camelCaseKeys,
  created,
  handleRoute,
  parseBody,
  parseRow,
  parseRows,
  requireRole,
  success,
} from '@/lib/api';
import { recordAdminAction } from '@/lib/admin/audit';
import {
  createFeatureFlagSchema,
  featureFlagRowSchema,
} from '@/features/admin/api/schemas';

// ---------------------------------------------------------------------------
// GET /api/v1/admin/feature-flags — list flags with current state
// ---------------------------------------------------------------------------
export const GET = handleRoute(async () => {
  const { supabase } = await requireRole('admin');

  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  return success(
    parseRows(
      (data ?? []).map(camelCaseKeys),
      featureFlagRowSchema,
      'GET /api/v1/admin/feature-flags',
    ),
  );
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/feature-flags — create flag
// ---------------------------------------------------------------------------
export const POST = handleRoute(async (req) => {
  const { supabase, user } = await requireRole('admin');
  const input = await parseBody(req, createFeatureFlagSchema);

  const { data: existing } = await supabase
    .from('feature_flags')
    .select('name')
    .eq('name', input.name)
    .maybeSingle();

  if (existing) {
    throw new ApiError('CONFLICT', `Flag "${input.name}" already exists`);
  }

  const { data: row, error: insertError } = await supabase
    .from('feature_flags')
    .insert({
      name: input.name,
      description: input.description ?? null,
      enabled: input.enabled,
      targeting: input.targeting,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single();

  if (insertError || !row) {
    throw new ApiError(
      'INTERNAL_ERROR',
      insertError?.message ?? 'Failed to create flag',
    );
  }

  await supabase.from('feature_flag_events').insert({
    flag_name: input.name,
    actor_id: user.id,
    action: 'created',
    before: null,
    after: row,
  });

  await recordAdminAction({
    actorId: user.id,
    action: 'flag_created',
    resourceType: 'feature_flags',
    resourceId: input.name,
    before: null,
    after: row,
  });

  return created(
    parseRow(
      camelCaseKeys(row),
      featureFlagRowSchema,
      'POST /api/v1/admin/feature-flags',
    ),
  );
});
