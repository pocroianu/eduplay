import type { AuthContext } from '@/lib/api';
import {
  ApiError,
  camelCaseKeys,
  parseRow,
  toSnakeCase,
} from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/server';
import {
  activityRowSchema,
  activityTypeRowSchema,
  activityVersionRowSchema,
  type ActivityRow,
  type ActivityTypeRow,
  type ActivityVersionRow,
} from '@/features/api/schemas/activity.schema';

import { parseConfigOrThrow } from './validate-config';
export { buildPreviewToken, verifyPreviewToken } from './preview-token';
export type { PreviewTokenPayload } from './preview-token';

type Supabase = AuthContext['supabase'];
type DbRow = Record<string, unknown>;

export interface ActivityPreviewSession {
  id: string;
  activityId: string;
  typeId: string;
  configData: unknown;
  createdBy: string;
  expiresAt: string;
}

export function snakeCaseColumns(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [toSnakeCase(key), value]),
  );
}

function camelCaseRowPreservingJson(
  row: unknown,
  jsonFields: Record<string, string>,
): DbRow {
  const dbRow = row as DbRow;
  const transformed = camelCaseKeys<DbRow>(dbRow);

  for (const [sourceKey, targetKey] of Object.entries(jsonFields)) {
    if (Object.prototype.hasOwnProperty.call(dbRow, sourceKey)) {
      transformed[targetKey] = dbRow[sourceKey];
    }
  }

  return transformed;
}

export function parseActivityTypeRowFromDb(
  row: unknown,
  context: string,
): ActivityTypeRow {
  return parseRow(
    camelCaseRowPreservingJson(row, { config_schema: 'configSchema' }),
    activityTypeRowSchema,
    context,
  );
}

export function parseActivityRowFromDb(
  row: unknown,
  context: string,
): ActivityRow {
  return parseRow(
    camelCaseRowPreservingJson(row, { config_data: 'configData' }),
    activityRowSchema,
    context,
  );
}

export function parseActivityVersionRowFromDb(
  row: unknown,
  context: string,
): ActivityVersionRow {
  return parseRow(
    camelCaseRowPreservingJson(row, { config_data: 'configData' }),
    activityVersionRowSchema,
    context,
  );
}

function previewSessionFromDb(row: unknown): ActivityPreviewSession {
  return camelCaseRowPreservingJson(row, {
    config_data: 'configData',
  }) as unknown as ActivityPreviewSession;
}

export async function getActivityTypeOrThrow(
  supabase: Supabase,
  typeId: string,
): Promise<ActivityTypeRow> {
  const { data, error } = await supabase
    .from('activity_types')
    .select('*')
    .eq('type_id', typeId)
    .single();

  if (error || !data) {
    throw ApiError.notFound('Activity type');
  }

  return parseActivityTypeRowFromDb(data, 'activity_types row');
}

export async function getActivityOrThrow(
  supabase: Supabase,
  activityId: string,
): Promise<ActivityRow> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('id', activityId)
    .single();

  if (error || !data) {
    throw ApiError.notFound('Activity');
  }

  return parseActivityRowFromDb(data, 'activities row');
}

export async function validateConfigForType(
  supabase: Supabase,
  typeId: string,
  configData: unknown,
  context: string,
): Promise<ActivityTypeRow> {
  const activityType = await getActivityTypeOrThrow(supabase, typeId);
  parseConfigOrThrow(activityType.configSchema, configData, context);
  return activityType;
}

export async function getLatestActivityVersion(
  supabase: Supabase,
  activityId: string,
): Promise<ActivityVersionRow | null> {
  const { data, error } = await supabase
    .from('activity_versions')
    .select('*')
    .eq('activity_id', activityId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return parseActivityVersionRowFromDb(data, 'latest activity_versions row');
}

export async function createActivityVersion(
  supabase: Supabase,
  input: {
    activityId: string;
    activityTypeId: string;
    configData: unknown;
    configSchemaVersion: number;
    publishedByUserId: string;
    versionNumber: number;
  },
): Promise<ActivityVersionRow> {
  const { data, error } = await supabase
    .from('activity_versions')
    .insert(snakeCaseColumns(input))
    .select()
    .single();

  if (error || !data) throw error ?? ApiError.notFound('Activity version');

  return parseActivityVersionRowFromDb(data, 'activity_versions insert');
}

export async function cleanupExpiredPreviewSessions(): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('activity_preview_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString());

  if (error) {
    console.warn('[cleanupExpiredPreviewSessions] failed', { error: error.message });
  }
}

export async function createPreviewSession(
  supabase: Supabase,
  input: {
    activityId: string;
    typeId: string;
    configData: unknown;
    createdBy: string;
  },
): Promise<{ previewId: string; expiresAt: string }> {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('activity_preview_sessions')
    .insert({
      activity_id: input.activityId,
      type_id: input.typeId,
      config_data: input.configData,
      created_by: input.createdBy,
      expires_at: expiresAt,
    })
    .select('id, expires_at')
    .single();

  if (error || !data) {
    throw error ?? ApiError.notFound('Preview session');
  }

  const row = camelCaseKeys<{ id: string; expiresAt: string }>(data);
  return {
    previewId: row.id,
    expiresAt: row.expiresAt,
  };
}

export async function getPreviewSessionOrThrow(
  supabase: Supabase,
  input: {
    previewId: string | undefined;
    activityId: string;
    actorId: string;
  },
): Promise<ActivityPreviewSession> {
  if (!input.previewId) {
    throw ApiError.forbidden('Preview session is required');
  }

  const { data, error } = await supabase
    .from('activity_preview_sessions')
    .select('*')
    .eq('id', input.previewId)
    .eq('activity_id', input.activityId)
    .eq('created_by', input.actorId)
    .single();

  if (error || !data) {
    throw ApiError.forbidden('Preview session is not valid for this activity');
  }

  const session = previewSessionFromDb(data);
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    throw ApiError.forbidden('Preview session has expired');
  }

  return session;
}

export async function updateActivityPublishState(
  supabase: Supabase,
  activityId: string,
): Promise<ActivityRow> {
  const { data, error } = await supabase
    .from('activities')
    .update({ status: 'published', is_published: true, visibility_scope: 'public' })
    .eq('id', activityId)
    .select()
    .single();

  if (error || !data) throw error ?? ApiError.notFound('Activity');

  return parseActivityRowFromDb(data, 'activities publish update');
}

export function versionMatchesDraft(
  version: ActivityVersionRow | null,
  activity: ActivityRow,
): boolean {
  return Boolean(
    version &&
      version.activityTypeId === activity.template &&
      version.configSchemaVersion === activity.configSchemaVersion &&
      JSON.stringify(version.configData) === JSON.stringify(activity.configData),
  );
}
