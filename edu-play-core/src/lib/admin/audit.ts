import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Visibility classifies how broadly an audit row may be exposed.
 *
 * - `platform` — only platform admins (default for admin-action rows)
 * - `family`   — visible to the data subject's family scope (parent/teacher)
 * - `internal` — internal-only state changes; no surfacing
 */
export type AuditVisibility = 'platform' | 'family' | 'internal';

export interface AdminActionRecord {
  /** Profile / auth.users id of the actor. Null only for system writes. */
  actorId: string | null;
  /** High-level action label, e.g. `flag_enabled`, `user_suspended`. */
  action: string;
  /** Logical resource type, e.g. `feature_flags`, `profiles`. */
  resourceType: string;
  /** Resource id. UUID strings land in `record_id`; anything else in `resource_id_text`. */
  resourceId: string;
  before?: unknown;
  after?: unknown;
  visibility?: AuditVisibility;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Append an audit row for an admin-driven mutation.
 *
 * Writes are made with the service-role client (bypasses RLS) so the helper
 * is safe to call from any v1 route handler that has already authenticated
 * the actor through `requireRole('admin')`.
 *
 * Behaviour: best-effort — on DB error we log to `console.error` and rethrow
 * so the caller can roll back (or reject the request) accordingly. This is
 * deliberate; admin mutations without an audit row are unsafe.
 */
export async function recordAdminAction(
  record: AdminActionRecord,
  client: SupabaseClient = createAdminClient(),
): Promise<void> {
  const isUuid = UUID_RE.test(record.resourceId);

  const row = {
    table_name: record.resourceType,
    record_id: isUuid ? record.resourceId : null,
    resource_id_text: isUuid ? null : record.resourceId,
    operation: null,
    action: record.action,
    visibility: record.visibility ?? 'platform',
    old_data: record.before ?? null,
    new_data: record.after ?? null,
    changed_by: record.actorId,
  };

  const { error } = await client.from('audit_logs').insert(row);

  if (error) {
    console.error('[recordAdminAction] failed to insert audit row', {
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      error: error.message,
    });
    throw new Error(`audit_logs insert failed: ${error.message}`);
  }
}

const SECRET_KEYS = new Set<string>([
  'pin',
  'pin_hash',
  'password',
  'password_hash',
  'token',
  'access_token',
  'refresh_token',
  'session_token',
]);

/**
 * Recursively scrub well-known secret keys from a JSON-shaped value.
 * Used by the audit CSV exporter so that even if a misbehaving caller
 * stuffs a token into `before`/`after`, it never leaves the platform.
 */
export function scrubSecrets<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => scrubSecrets(v)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = scrubSecrets(v);
      }
    }
    return out as unknown as T;
  }
  return value;
}
