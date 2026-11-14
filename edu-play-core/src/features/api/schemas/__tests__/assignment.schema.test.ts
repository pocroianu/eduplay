import { describe, it, expect } from 'vitest';
import { assignmentRowSchema, createAssignmentSchema } from '../assignment.schema';

const validUuid = '550e8400-e29b-41d4-a716-446655440000';
const validUuid2 = '660e8400-e29b-41d4-a716-446655440000';
const versionUuid = '770e8400-e29b-41d4-a716-446655440000';

describe('createAssignmentSchema', () => {
  it('accepts valid Activity input with classId', () => {
    const result = createAssignmentSchema.safeParse({
      activityId: validUuid,
      classId: validUuid2,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid Activity input with studentId', () => {
    const result = createAssignmentSchema.safeParse({
      activityId: validUuid,
      studentId: validUuid2,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid Activity input with selected studentIds', () => {
    const result = createAssignmentSchema.safeParse({
      activityId: validUuid,
      studentIds: [validUuid2, versionUuid],
    });
    expect(result.success).toBe(true);
  });

  it('rejects input with classId and studentId', () => {
    const result = createAssignmentSchema.safeParse({
      activityId: validUuid,
      classId: validUuid,
      studentId: validUuid2,
    });
    expect(result.success).toBe(false);
  });

  it('rejects input with classId and selected studentIds', () => {
    const result = createAssignmentSchema.safeParse({
      activityId: validUuid,
      classId: validUuid,
      studentIds: [validUuid2],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty selected studentIds', () => {
    const result = createAssignmentSchema.safeParse({
      activityId: validUuid,
      studentIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects legacy gameId input', () => {
    const result = createAssignmentSchema.safeParse({
      gameId: validUuid,
      studentId: validUuid2,
    });
    expect(result.success).toBe(false);
  });

  it('rejects input without activityId', () => {
    const result = createAssignmentSchema.safeParse({
      studentId: validUuid2,
    });
    expect(result.success).toBe(false);
  });

  it('rejects input with neither classId nor studentId', () => {
    const result = createAssignmentSchema.safeParse({
      activityId: validUuid,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID for activityId', () => {
    const result = createAssignmentSchema.safeParse({
      activityId: 'not-a-uuid',
      classId: validUuid2,
    });
    expect(result.success).toBe(false);
  });

  it('defaults isMandatory to false', () => {
    const result = createAssignmentSchema.safeParse({
      activityId: validUuid,
      classId: validUuid2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isMandatory).toBe(false);
    }
  });
});

describe('assignmentRowSchema', () => {
  it('includes the pinned activity and version ids when present', () => {
    const result = assignmentRowSchema.safeParse({
      id: validUuid,
      activityId: validUuid2,
      classId: validUuid,
      studentId: null,
      teacherId: validUuid2,
      versionId: versionUuid,
      dueDate: null,
      isMandatory: false,
      createdAt: '2026-05-15T10:00:00.000Z',
      updatedAt: '2026-05-15T10:00:00.000Z',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activityId).toBe(validUuid2);
      expect(result.data.versionId).toBe(versionUuid);
    }
  });
});
