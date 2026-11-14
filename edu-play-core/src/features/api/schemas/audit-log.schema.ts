import { z } from 'zod';

export const listAuditLogQuerySchema = z.object({
  action: z.enum(['publish', 'delete', 'visibility_change', 'create']).optional(),
  artifactId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * Public API entity shape for an `audit_log` row (camelCase, after
 * `camelCaseKeys`).
 *
 * `audit_log` is the artifact-state-change trail (separate from the
 * generic `audit_logs` table consumed by `/api/v1/admin/audit`). The DB
 * has no CHECK constraint on `action` or `actorRole`, so they are
 * validated as free strings; `previousState`/`newState` are jsonb.
 */
export const auditLogRowSchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  actorId: z.string().uuid(),
  actorRole: z.string(),
  artifactId: z.string().uuid(),
  artifactTable: z.string(),
  previousState: z.unknown().nullable(),
  newState: z.unknown().nullable(),
  createdAt: z.string().nullable(),
});

export type AuditLogRow = z.infer<typeof auditLogRowSchema>;
