import {
  ApiError,
  camelCaseKeys,
  handleRoute,
  noContent,
  parseBody,
  parseRow,
  parseRows,
  requireRole,
  success,
} from '@/lib/api';
import { recordAdminAction } from '@/lib/admin/audit';
import {
  featureFlagEventRowSchema,
  featureFlagNameSchema,
  featureFlagRowSchema,
  updateFeatureFlagSchema,
} from '@/features/admin/api/schemas';

interface FlagContext {
  params: Promise<{ name: string }>;
}

const FEATURE_FLAG_EVENTS_PAGE = 50;

async function loadFlag(
  supabase: Awaited<ReturnType<typeof requireRole>>['supabase'],
  name: string,
) {
  const { data: flag, error } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('name', name)
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!flag) throw ApiError.notFound('Feature flag');
  return flag;
}

// ---------------------------------------------------------------------------
// GET /api/v1/admin/feature-flags/:name — flag detail + last 50 events
// ---------------------------------------------------------------------------
export const GET = handleRoute(async (_req, context) => {
  const { supabase } = await requireRole('admin');
  const { name } = await (context as FlagContext).params;
  const parsedName = featureFlagNameSchema.parse(name);

  const flag = await loadFlag(supabase, parsedName);

  const { data: events, error: eventsError } = await supabase
    .from('feature_flag_events')
    .select('*')
    .eq('flag_name', parsedName)
    .order('created_at', { ascending: false })
    .limit(FEATURE_FLAG_EVENTS_PAGE);

  if (eventsError) {
    throw new ApiError('INTERNAL_ERROR', eventsError.message);
  }

  const parsedFlag = parseRow(
    camelCaseKeys(flag),
    featureFlagRowSchema,
    'GET /api/v1/admin/feature-flags/:name',
  );
  const parsedEvents = parseRows(
    (events ?? []).map(camelCaseKeys),
    featureFlagEventRowSchema,
    'GET /api/v1/admin/feature-flags/:name events',
  );

  return success({
    ...parsedFlag,
    events: parsedEvents,
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/feature-flags/:name — partial update
// ---------------------------------------------------------------------------
export const PATCH = handleRoute(async (req, context) => {
  const { supabase, user } = await requireRole('admin');
  const { name } = await (context as FlagContext).params;
  const parsedName = featureFlagNameSchema.parse(name);
  const patch = await parseBody(req, updateFeatureFlagSchema);

  const before = await loadFlag(supabase, parsedName);

  const updates: Record<string, unknown> = { updated_by: user.id };
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.enabled !== undefined) updates.enabled = patch.enabled;
  if (patch.targeting !== undefined) updates.targeting = patch.targeting;

  const { data: after, error: updateError } = await supabase
    .from('feature_flags')
    .update(updates)
    .eq('name', parsedName)
    .select()
    .single();

  if (updateError || !after) {
    throw new ApiError(
      'INTERNAL_ERROR',
      updateError?.message ?? 'Failed to update flag',
    );
  }

  // Record event(s) — one per semantic change so the audit trail is granular.
  const events: Array<{ action: string; before: unknown; after: unknown }> = [];

  if (patch.enabled !== undefined && before.enabled !== patch.enabled) {
    events.push({
      action: patch.enabled ? 'enabled' : 'disabled',
      before: { enabled: before.enabled },
      after: { enabled: patch.enabled },
    });
  }
  if (patch.targeting !== undefined) {
    events.push({
      action: 'targeting_changed',
      before: { targeting: before.targeting },
      after: { targeting: after.targeting },
    });
  }
  if (patch.description !== undefined && before.description !== patch.description) {
    events.push({
      action: 'description_changed',
      before: { description: before.description },
      after: { description: after.description },
    });
  }

  if (events.length > 0) {
    await supabase.from('feature_flag_events').insert(
      events.map((evt) => ({
        flag_name: parsedName,
        actor_id: user.id,
        action: evt.action,
        before: evt.before,
        after: evt.after,
      })),
    );
  }

  await recordAdminAction({
    actorId: user.id,
    action: 'flag_updated',
    resourceType: 'feature_flags',
    resourceId: parsedName,
    before,
    after,
  });

  return success(
    parseRow(
      camelCaseKeys(after),
      featureFlagRowSchema,
      'PATCH /api/v1/admin/feature-flags/:name',
    ),
  );
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/admin/feature-flags/:name — hard delete (MVP scope)
// ---------------------------------------------------------------------------
export const DELETE = handleRoute(async (_req, context) => {
  const { supabase, user } = await requireRole('admin');
  const { name } = await (context as FlagContext).params;
  const parsedName = featureFlagNameSchema.parse(name);

  const before = await loadFlag(supabase, parsedName);

  await supabase.from('feature_flag_events').insert({
    flag_name: parsedName,
    actor_id: user.id,
    action: 'deleted',
    before,
    after: null,
  });

  const { error: deleteError } = await supabase
    .from('feature_flags')
    .delete()
    .eq('name', parsedName);

  if (deleteError) {
    throw new ApiError('INTERNAL_ERROR', deleteError.message);
  }

  await recordAdminAction({
    actorId: user.id,
    action: 'flag_deleted',
    resourceType: 'feature_flags',
    resourceId: parsedName,
    before,
    after: null,
  });

  return noContent();
});
