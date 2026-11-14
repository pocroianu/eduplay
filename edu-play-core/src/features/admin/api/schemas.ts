import { z } from 'zod';

const ROLE_VALUES = ['teacher', 'parent', 'student', 'admin'] as const;
const USER_STATUS_VALUES = ['active', 'suspended'] as const;
const FLAG_EVENT_ACTION_VALUES = [
  'created',
  'enabled',
  'disabled',
  'targeting_changed',
  'description_changed',
  'deleted',
] as const;

const FLAG_NAME_RE = /^[a-z][a-z0-9_]*$/;

const targetingShape = z
  .object({
    roles: z.array(z.enum(ROLE_VALUES)).optional(),
    allow: z.array(z.string().uuid()).optional(),
    deny: z.array(z.string().uuid()).optional(),
  })
  .strict();

export const targetingSchema = targetingShape.default({});

export type TargetingRules = z.infer<typeof targetingShape>;

// ---------------------------------------------------------------------------
// /api/v1/admin/users
// ---------------------------------------------------------------------------

export const listAdminUsersQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLE_VALUES).optional(),
  status: z.enum(USER_STATUS_VALUES).optional(),
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

export const updateAdminUserSchema = z
  .object({
    status: z.enum(USER_STATUS_VALUES),
  })
  .strict();

export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;

const adminUserSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  fullName: z.string(),
  role: z.enum(ROLE_VALUES),
  status: z.enum(USER_STATUS_VALUES),
  lastSignInAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;

export const resetCredentialsResponseSchema = z.object({
  channel: z.enum(['email', 'pin']),
  // pin is only present for students; emitted exactly once.
  pin: z.string().regex(/^\d{4}$/).optional(),
  // emailSentTo is only present for teachers/parents.
  emailSentTo: z.string().email().optional(),
});

export type ResetCredentialsResponse = z.infer<typeof resetCredentialsResponseSchema>;

// ---------------------------------------------------------------------------
// /api/v1/admin/feature-flags
// ---------------------------------------------------------------------------

export const featureFlagNameSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(FLAG_NAME_RE, 'must be lowercase snake_case');

export const createFeatureFlagSchema = z
  .object({
    name: featureFlagNameSchema,
    description: z.string().trim().max(500).optional(),
    enabled: z.boolean().default(false),
    targeting: targetingSchema,
  })
  .strict();

export type CreateFeatureFlagInput = z.infer<typeof createFeatureFlagSchema>;

export const updateFeatureFlagSchema = z
  .object({
    description: z.string().trim().max(500).nullable().optional(),
    enabled: z.boolean().optional(),
    targeting: targetingShape.optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.description !== undefined ||
      v.enabled !== undefined ||
      v.targeting !== undefined,
    { message: 'at least one of description, enabled, targeting is required' },
  );

export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;

const featureFlagSchema = z.object({
  name: featureFlagNameSchema,
  description: z.string().nullable(),
  enabled: z.boolean(),
  targeting: targetingSchema,
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type FeatureFlag = z.infer<typeof featureFlagSchema>;

const featureFlagEventSchema = z.object({
  id: z.string().uuid(),
  flagName: featureFlagNameSchema,
  actorId: z.string().uuid().nullable(),
  action: z.enum(FLAG_EVENT_ACTION_VALUES),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  createdAt: z.string().datetime(),
});

export type FeatureFlagEvent = z.infer<typeof featureFlagEventSchema>;

// ---------------------------------------------------------------------------
// /api/v1/admin/audit
// ---------------------------------------------------------------------------

export const listAdminAuditQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  actor: z.string().uuid().optional(),
  action: z.string().min(1).max(100).optional(),
  resourceType: z.string().min(1).max(100).optional(),
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListAdminAuditQuery = z.infer<typeof listAdminAuditQuerySchema>;

const adminAuditEntrySchema = z.object({
  id: z.string(),
  actorId: z.string().uuid().nullable(),
  action: z.string().nullable(),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  visibility: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type AdminAuditEntry = z.infer<typeof adminAuditEntrySchema>;

// ---------------------------------------------------------------------------
// DB row schemas — validate Supabase rows after `camelCaseKeys`
//
// These describe the camelCased shape of rows returned to admin endpoints,
// so the schema doubles as the public entity contract. They are intentionally
// permissive on dimensions we don't enforce on read (free strings where the
// DB has no CHECK; `z.unknown().nullable()` for jsonb columns).
// ---------------------------------------------------------------------------

const profileRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  fullName: z.string(),
  role: z.enum(ROLE_VALUES),
  status: z.enum(USER_STATUS_VALUES),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

export const adminUserListRowSchema = profileRowSchema.pick({
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  createdAt: true,
});

export type AdminUserListRow = z.infer<typeof adminUserListRowSchema>;

export const adminUserDetailRowSchema = profileRowSchema.pick({
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
});

export type AdminUserDetailRow = z.infer<typeof adminUserDetailRowSchema>;

export const adminUserStatusRowSchema = profileRowSchema.pick({
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
});

export type AdminUserStatusRow = z.infer<typeof adminUserStatusRowSchema>;

// Linked records returned by GET /api/v1/admin/users/:id
export const adminLinkedClassRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  gradeLevel: z.string().nullable(),
  schoolYear: z.string().nullable(),
  isActive: z.boolean().nullable(),
});

export const adminLinkedChildRowSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
});

export const adminUserAuditHeadRowSchema = z.object({
  id: z.number().int(),
  action: z.string().nullable(),
  tableName: z.string(),
  changedAt: z.string(),
});

export const deletionRequestRowSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string().nullable(),
  status: z.string(),
  requestedAt: z.string(),
  scheduledDeletionAt: z.string(),
  cancelledAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type DeletionRequestRow = z.infer<typeof deletionRequestRowSchema>;

export const featureFlagRowSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  enabled: z.boolean(),
  targeting: z.unknown(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type FeatureFlagRow = z.infer<typeof featureFlagRowSchema>;

export const featureFlagEventRowSchema = z.object({
  id: z.string().uuid(),
  flagName: z.string(),
  actorId: z.string().uuid().nullable(),
  action: z.string(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  createdAt: z.string(),
});

export type FeatureFlagEventRow = z.infer<typeof featureFlagEventRowSchema>;

export const auditLogRowSchema = z.object({
  id: z.number().int(),
  changedBy: z.string().uuid().nullable(),
  action: z.string().nullable(),
  tableName: z.string(),
  recordId: z.string().nullable(),
  resourceIdText: z.string().nullable(),
  oldData: z.unknown().nullable(),
  newData: z.unknown().nullable(),
  visibility: z.string().nullable(),
  // `operation` is INSERT/UPDATE/DELETE for trigger-driven rows, but admin-action
  // rows from `recordAdminAction()` write `null` here (the constraint pair on
  // audit_logs requires `operation IS NOT NULL OR action IS NOT NULL`).
  operation: z.string().nullable(),
  changedAt: z.string(),
});

export type AuditLogRow = z.infer<typeof auditLogRowSchema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ADMIN_AUDIT_CSV_ROW_LIMIT = 10_000;

const FLAG_EVENT_ACTIONS = FLAG_EVENT_ACTION_VALUES;
const ADMIN_USER_STATUSES = USER_STATUS_VALUES;
export const ADMIN_USER_ROLES = ROLE_VALUES;
