import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface ActiveUsersStat {
  count: number;
  windowDays: number;
}

export interface GdprOpenStat {
  count: number;
}

export interface AuditIncidentsStat {
  count: number;
  windowHours: number;
}

export type FlagEventAction =
  | 'created'
  | 'enabled'
  | 'disabled'
  | 'targeting_changed'
  | 'description_changed'
  | 'deleted';

export interface RecentFlagChange {
  flagName: string;
  action: FlagEventAction;
  actorId: string | null;
  occurredAt: string;
}

export interface PublishedGamesStat {
  published: number;
  total: number;
}

export interface RecentAuditEntry {
  id: string;
  actorId: string | null;
  action: string | null;
  resourceType: string;
  resourceId: string | null;
  occurredAt: string;
}

export interface AdminOverviewSnapshot {
  activeUsers: ActiveUsersStat;
  gdprOpen: GdprOpenStat;
  auditIncidents: AuditIncidentsStat;
  recentFlagChanges: RecentFlagChange[];
  publishedGames: PublishedGamesStat;
  recentAuditEntries: RecentAuditEntry[];
}

/**
 * Distinct admin/teacher/parent actors that produced an audit_logs row in
 * the rolling 7-day window. Counts the floor of recent activity, not the
 * total user base — child accounts almost never write audit_logs rows so
 * they are correctly excluded.
 */
export async function getActiveUsers7d(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<ActiveUsersStat> {
  const since = new Date(now.getTime() - SEVEN_DAYS_MS).toISOString();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('changed_by')
    .gte('changed_at', since)
    .not('changed_by', 'is', null);

  if (error) throw new Error(`getActiveUsers7d failed: ${error.message}`);

  const distinct = new Set<string>();
  for (const row of (data ?? []) as Array<{ changed_by: string | null }>) {
    if (row.changed_by) distinct.add(row.changed_by);
  }
  return { count: distinct.size, windowDays: 7 };
}

/**
 * Open GDPR Art.17 deletion requests — `pending` status, where the 30-day
 * grace window has not yet elapsed. Cancelled and completed rows are out.
 */
export async function getGdprOpenCount(
  supabase: SupabaseClient,
): Promise<GdprOpenStat> {
  const { count, error } = await supabase
    .from('deletion_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) throw new Error(`getGdprOpenCount failed: ${error.message}`);
  return { count: count ?? 0 };
}

/**
 * Admin-driven mutations recorded in `audit_logs` over the rolling 24-hour
 * window. Trigger-generated rows (`action IS NULL`) are excluded — only
 * rows written by `recordAdminAction()` count as "incidents" surfaced on
 * the overview.
 */
export async function getAuditIncidents24h(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<AuditIncidentsStat> {
  const since = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS).toISOString();
  const { count, error } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .gte('changed_at', since)
    .not('action', 'is', null);

  if (error) throw new Error(`getAuditIncidents24h failed: ${error.message}`);
  return { count: count ?? 0, windowHours: 24 };
}

/**
 * Latest feature-flag change events, newest first. The overview surface
 * shows the last 3 by default; raise the limit only if a future ticket
 * needs more.
 */
export async function getRecentFlagChanges(
  supabase: SupabaseClient,
  limit = 3,
): Promise<RecentFlagChange[]> {
  const { data, error } = await supabase
    .from('feature_flag_events')
    .select('flag_name, action, actor_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentFlagChanges failed: ${error.message}`);

  return ((data ?? []) as Array<{
    flag_name: string;
    action: FlagEventAction;
    actor_id: string | null;
    created_at: string;
  }>).map((row) => ({
    flagName: row.flag_name,
    action: row.action,
    actorId: row.actor_id,
    occurredAt: row.created_at,
  }));
}

/**
 * Latest audit_logs rows for the overview activity feed. Includes both
 * trigger-driven rows (`action IS NULL`) and admin-action rows so the feed
 * reflects every recorded change. The page surfaces the top 10 by default.
 */
export async function getRecentAuditEntries(
  supabase: SupabaseClient,
  limit = 10,
): Promise<RecentAuditEntry[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, changed_by, action, table_name, record_id, resource_id_text, changed_at')
    .order('changed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentAuditEntries failed: ${error.message}`);

  return ((data ?? []) as Array<{
    id: string | number;
    changed_by: string | null;
    action: string | null;
    table_name: string;
    record_id: string | null;
    resource_id_text: string | null;
    changed_at: string;
  }>).map((row) => ({
    id: String(row.id),
    actorId: row.changed_by,
    action: row.action,
    resourceType: row.table_name,
    resourceId: row.resource_id_text ?? row.record_id ?? null,
    occurredAt: row.changed_at,
  }));
}

/**
 * Published vs total Activity counts for the catalog stat tile. Two parallel
 * `count: 'exact', head: true` calls — no row payload is transferred.
 */
export async function getPublishedGamesStats(
  supabase: SupabaseClient,
): Promise<PublishedGamesStat> {
  const [totalRes, publishedRes] = await Promise.all([
    supabase.from('activities').select('*', { count: 'exact', head: true }),
    supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true),
  ]);

  if (totalRes.error)
    throw new Error(`getPublishedGamesStats total failed: ${totalRes.error.message}`);
  if (publishedRes.error)
    throw new Error(
      `getPublishedGamesStats published failed: ${publishedRes.error.message}`,
    );

  return {
    published: publishedRes.count ?? 0,
    total: totalRes.count ?? 0,
  };
}

/**
 * Composite snapshot used by the future `/admin` overview surface. Runs
 * every component query in parallel; surfaces will pick the fields they
 * render and ignore the rest.
 */
export async function getAdminOverviewSnapshot(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<AdminOverviewSnapshot> {
  const [
    activeUsers,
    gdprOpen,
    auditIncidents,
    recentFlagChanges,
    publishedGames,
    recentAuditEntries,
  ] = await Promise.all([
    getActiveUsers7d(supabase, now),
    getGdprOpenCount(supabase),
    getAuditIncidents24h(supabase, now),
    getRecentFlagChanges(supabase),
    getPublishedGamesStats(supabase),
    getRecentAuditEntries(supabase),
  ]);

  return {
    activeUsers,
    gdprOpen,
    auditIncidents,
    recentFlagChanges,
    publishedGames,
    recentAuditEntries,
  };
}
