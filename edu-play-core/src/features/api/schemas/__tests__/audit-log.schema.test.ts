import { describe, it, expect } from 'vitest';
import { auditLogRowSchema } from '../audit-log.schema';

describe('auditLogRowSchema', () => {
  const baseRow = {
    id: '11111111-1111-4111-8111-111111111111',
    action: 'publish',
    actorId: '22222222-2222-4222-8222-222222222222',
    actorRole: 'teacher',
    artifactId: '33333333-3333-4333-8333-333333333333',
    artifactTable: 'child_artifacts',
    previousState: { visibility: 'private' },
    newState: { visibility: 'family' },
    createdAt: '2026-05-03T10:00:00.000Z',
  };

  it('accepts a fully populated row', () => {
    const result = auditLogRowSchema.safeParse(baseRow);
    expect(result.success).toBe(true);
  });

  it('accepts null jsonb state columns and createdAt', () => {
    const result = auditLogRowSchema.safeParse({
      ...baseRow,
      previousState: null,
      newState: null,
      createdAt: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a row with non-UUID actorId (DB column is UUID NOT NULL)', () => {
    const result = auditLogRowSchema.safeParse({ ...baseRow, actorId: 'system' });
    expect(result.success).toBe(false);
  });

  it('rejects a row missing required actorRole', () => {
    const { actorRole: _omit, ...rest } = baseRow;
    const result = auditLogRowSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
