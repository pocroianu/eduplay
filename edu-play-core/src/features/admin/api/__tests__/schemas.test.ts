import { describe, it, expect } from 'vitest';
import {
  adminLinkedChildRowSchema,
  adminLinkedClassRowSchema,
  adminUserAuditHeadRowSchema,
  adminUserDetailRowSchema,
  adminUserListRowSchema,
  adminUserStatusRowSchema,
  auditLogRowSchema,
  createFeatureFlagSchema,
  deletionRequestRowSchema,
  featureFlagEventRowSchema,
  featureFlagRowSchema,
  listAdminAuditQuerySchema,
  listAdminUsersQuerySchema,
  targetingSchema,
  updateAdminUserSchema,
  updateFeatureFlagSchema,
} from '../schemas';

describe('targetingSchema', () => {
  it('accepts an empty object and returns an empty object', () => {
    expect(targetingSchema.parse({})).toEqual({});
  });

  it('rejects unknown role values', () => {
    const result = targetingSchema.safeParse({ roles: ['nope'] });
    expect(result.success).toBe(false);
  });

  it('requires UUIDs in allow/deny lists', () => {
    const result = targetingSchema.safeParse({ allow: ['not-a-uuid'] });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields', () => {
    const result = targetingSchema.safeParse({ rollout: 0.5 });
    expect(result.success).toBe(false);
  });
});

describe('createFeatureFlagSchema', () => {
  it('requires snake_case lowercase name', () => {
    expect(createFeatureFlagSchema.safeParse({ name: 'BadName' }).success).toBe(false);
    expect(createFeatureFlagSchema.safeParse({ name: '1starts_with_digit' }).success).toBe(false);
    expect(createFeatureFlagSchema.safeParse({ name: 'good_name' }).success).toBe(true);
  });

  it('defaults enabled to false and targeting to {}', () => {
    const parsed = createFeatureFlagSchema.parse({ name: 'game_builder_beta' });
    expect(parsed.enabled).toBe(false);
    expect(parsed.targeting).toEqual({});
  });
});

describe('updateFeatureFlagSchema', () => {
  it('rejects empty body', () => {
    expect(updateFeatureFlagSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a single-field patch', () => {
    expect(updateFeatureFlagSchema.safeParse({ enabled: true }).success).toBe(true);
  });

  it('rejects unknown fields', () => {
    expect(updateFeatureFlagSchema.safeParse({ enabled: true, foo: 1 }).success).toBe(false);
  });
});

describe('listAdminUsersQuerySchema', () => {
  it('coerces limit and applies default', () => {
    const parsed = listAdminUsersQuerySchema.parse({});
    expect(parsed.limit).toBe(25);
  });

  it('caps limit at 100', () => {
    expect(listAdminUsersQuerySchema.safeParse({ limit: '200' }).success).toBe(false);
  });

  it('passes through optional filters', () => {
    const parsed = listAdminUsersQuerySchema.parse({
      q: 'ana',
      role: 'teacher',
      status: 'active',
      cursor: 'abc',
      limit: '10',
    });
    expect(parsed).toMatchObject({
      q: 'ana',
      role: 'teacher',
      status: 'active',
      cursor: 'abc',
      limit: 10,
    });
  });
});

describe('updateAdminUserSchema', () => {
  it('requires status', () => {
    expect(updateAdminUserSchema.safeParse({}).success).toBe(false);
  });

  it('rejects invalid status values', () => {
    expect(updateAdminUserSchema.safeParse({ status: 'banned' }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(
      updateAdminUserSchema.safeParse({ status: 'active', extra: true }).success,
    ).toBe(false);
  });
});

describe('listAdminAuditQuerySchema', () => {
  it('caps limit at 200 and defaults to 50', () => {
    expect(listAdminAuditQuerySchema.parse({}).limit).toBe(50);
    expect(listAdminAuditQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('rejects non-datetime from/to', () => {
    expect(listAdminAuditQuerySchema.safeParse({ from: 'yesterday' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Row schemas — DB-boundary validation
// ---------------------------------------------------------------------------

const userId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

describe('adminUserListRowSchema', () => {
  const validRow = {
    id: userId,
    email: 'ana@example.com',
    fullName: 'Ana Popescu',
    role: 'teacher',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('accepts a well-formed list row', () => {
    expect(adminUserListRowSchema.parse(validRow)).toEqual(validRow);
  });

  it('rejects unknown role values (DB CHECK constraint mirror)', () => {
    expect(
      adminUserListRowSchema.safeParse({ ...validRow, role: 'principal' }).success,
    ).toBe(false);
  });

  it('rejects unknown status values', () => {
    expect(
      adminUserListRowSchema.safeParse({ ...validRow, status: 'banned' }).success,
    ).toBe(false);
  });

  it('rejects a non-uuid id', () => {
    expect(
      adminUserListRowSchema.safeParse({ ...validRow, id: 'abc' }).success,
    ).toBe(false);
  });

  it('does not require avatarUrl/updatedAt (not selected by list query)', () => {
    expect(adminUserListRowSchema.safeParse(validRow).success).toBe(true);
  });
});

describe('adminUserDetailRowSchema', () => {
  const validRow = {
    id: userId,
    email: 'ana@example.com',
    fullName: 'Ana Popescu',
    role: 'admin',
    status: 'suspended',
    avatarUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  };

  it('accepts a full detail row', () => {
    expect(adminUserDetailRowSchema.parse(validRow)).toEqual(validRow);
  });

  it('accepts null avatarUrl/createdAt/updatedAt', () => {
    expect(
      adminUserDetailRowSchema.safeParse({
        ...validRow,
        avatarUrl: null,
        createdAt: null,
        updatedAt: null,
      }).success,
    ).toBe(true);
  });
});

describe('adminUserStatusRowSchema', () => {
  it('accepts the slim PATCH-response projection', () => {
    expect(
      adminUserStatusRowSchema.safeParse({
        id: userId,
        email: 'ana@example.com',
        fullName: 'Ana Popescu',
        role: 'parent',
        status: 'active',
      }).success,
    ).toBe(true);
  });
});

describe('adminLinkedClassRowSchema', () => {
  it('accepts a class summary row', () => {
    expect(
      adminLinkedClassRowSchema.safeParse({
        id: userId,
        name: 'Clasa Albinelor',
        gradeLevel: 'kindergarten',
        schoolYear: '2025-2026',
        isActive: true,
      }).success,
    ).toBe(true);
  });

  it('accepts nullable gradeLevel/schoolYear/isActive', () => {
    expect(
      adminLinkedClassRowSchema.safeParse({
        id: userId,
        name: 'Clasa Albinelor',
        gradeLevel: null,
        schoolYear: null,
        isActive: null,
      }).success,
    ).toBe(true);
  });
});

describe('adminLinkedChildRowSchema', () => {
  it('accepts a child summary row', () => {
    expect(
      adminLinkedChildRowSchema.safeParse({
        id: userId,
        username: 'ana_popescu',
      }).success,
    ).toBe(true);
  });

  it('rejects missing username', () => {
    expect(adminLinkedChildRowSchema.safeParse({ id: userId }).success).toBe(false);
  });
});

describe('adminUserAuditHeadRowSchema', () => {
  it('accepts an audit_logs head entry (numeric id)', () => {
    expect(
      adminUserAuditHeadRowSchema.safeParse({
        id: 42,
        action: 'user_suspended',
        tableName: 'profiles',
        changedAt: '2026-04-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('rejects a string id (audit_logs.id is bigint)', () => {
    expect(
      adminUserAuditHeadRowSchema.safeParse({
        id: '42',
        action: 'user_suspended',
        tableName: 'profiles',
        changedAt: '2026-04-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});

describe('deletionRequestRowSchema', () => {
  const validRow = {
    id: userId,
    userId: otherId,
    reason: 'Admin-initiated by admin-uuid',
    status: 'pending',
    requestedAt: '2026-04-01T00:00:00.000Z',
    scheduledDeletionAt: '2026-05-01T00:00:00.000Z',
    cancelledAt: null,
    completedAt: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  };

  it('accepts a deletion_requests row', () => {
    expect(deletionRequestRowSchema.parse(validRow)).toEqual(validRow);
  });

  it('rejects a non-uuid user_id', () => {
    expect(
      deletionRequestRowSchema.safeParse({ ...validRow, userId: 'abc' }).success,
    ).toBe(false);
  });
});

describe('featureFlagRowSchema', () => {
  const validRow = {
    name: 'game_builder_beta',
    description: null,
    enabled: false,
    targeting: { roles: ['teacher'] },
    createdBy: userId,
    updatedBy: userId,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  };

  it('accepts a feature_flags row', () => {
    expect(featureFlagRowSchema.parse(validRow)).toEqual(validRow);
  });

  it('treats targeting as opaque (jsonb)', () => {
    // Anything jsonb-decodable should pass — we don't enforce shape on read
    // because the column has no DB-level constraint beyond `jsonb`.
    expect(
      featureFlagRowSchema.safeParse({ ...validRow, targeting: 'oddly-typed' })
        .success,
    ).toBe(true);
  });

  it('rejects missing required fields', () => {
    const { name: _name, ...rest } = validRow;
    expect(featureFlagRowSchema.safeParse(rest).success).toBe(false);
  });
});

describe('featureFlagEventRowSchema', () => {
  it('accepts a feature_flag_events row', () => {
    expect(
      featureFlagEventRowSchema.safeParse({
        id: userId,
        flagName: 'game_builder_beta',
        actorId: otherId,
        action: 'enabled',
        before: { enabled: false },
        after: { enabled: true },
        createdAt: '2026-04-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('accepts null before/after (creation event)', () => {
    expect(
      featureFlagEventRowSchema.safeParse({
        id: userId,
        flagName: 'game_builder_beta',
        actorId: null,
        action: 'created',
        before: null,
        after: null,
        createdAt: '2026-04-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});

describe('auditLogRowSchema', () => {
  const validRow = {
    id: 7,
    changedBy: userId,
    action: 'user_suspended',
    tableName: 'profiles',
    recordId: userId,
    resourceIdText: null,
    oldData: { status: 'active' },
    newData: { status: 'suspended' },
    visibility: null,
    operation: 'UPDATE',
    changedAt: '2026-04-01T00:00:00.000Z',
  };

  it('accepts a raw audit_logs row', () => {
    expect(auditLogRowSchema.parse(validRow)).toEqual(validRow);
  });

  it('requires numeric id and rejects non-string operation', () => {
    expect(
      auditLogRowSchema.safeParse({ ...validRow, id: 'seven' }).success,
    ).toBe(false);
    expect(
      auditLogRowSchema.safeParse({ ...validRow, operation: 99 }).success,
    ).toBe(false);
  });

  it('accepts a null operation (admin-action row written by recordAdminAction)', () => {
    const adminActionRow = {
      ...validRow,
      operation: null,
      action: 'flag_enabled',
      tableName: 'feature_flags',
    };
    const parsed = auditLogRowSchema.parse(adminActionRow);
    expect(parsed.operation).toBeNull();
    expect(parsed.action).toBe('flag_enabled');
  });
});
