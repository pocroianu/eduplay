import { describe, it, expect } from 'vitest';
import { progressRowSchema, recordProgressSchema } from '../progress.schema';

const studentId = '22222222-2222-4222-8222-222222222222';
const activityId = '44444444-4444-4444-8444-444444444444';
const versionId = '55555555-5555-4555-8555-555555555555';
const gameId = '33333333-3333-4333-8333-333333333333';

describe('recordProgressSchema', () => {
  it('requires the complete cumulative session contract while retaining legacy deltas', () => {
    const session = { activityId, sessionId: studentId, sequence: 1, timeSpent: 5, status: 'in_progress' };
    expect(recordProgressSchema.safeParse(session).success).toBe(true);
    expect(recordProgressSchema.safeParse({ ...session, sequence: undefined }).success).toBe(false);
    expect(recordProgressSchema.safeParse({ ...session, timeSpent: undefined }).success).toBe(false);
    expect(recordProgressSchema.safeParse({ ...session, status: 'not_started' }).success).toBe(false);
    expect(recordProgressSchema.safeParse({ activityId, sequence: 1 }).success).toBe(false);
    expect(recordProgressSchema.safeParse({ activityId, timeSpent: 5 }).success).toBe(true);
  });
  it('accepts canonical Activity progress input', () => {
    const result = recordProgressSchema.safeParse({
      studentId,
      activityId,
      versionId,
      status: 'in_progress',
      score: 80,
      timeSpent: 120,
    });

    expect(result.success).toBe(true);
  });

  it('rejects deprecated legacy gameId input', () => {
    const result = recordProgressSchema.safeParse({
      studentId,
      gameId,
      status: 'completed',
    });

    expect(result.success).toBe(false);
  });

  it('rejects progress without activityId', () => {
    const result = recordProgressSchema.safeParse({ studentId, status: 'in_progress' });
    expect(result.success).toBe(false);
  });
});

describe('progressRowSchema', () => {
  const baseRow = {
    id: '11111111-1111-4111-8111-111111111111',
    studentId,
    activityId,
    status: 'in_progress',
    score: 80,
    attempts: 2,
    timeSpent: 120,
    completedAt: null,
    lastPlayedAt: '2026-05-03T10:00:00.000Z',
    data: { level: 3 },
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-03T10:00:00.000Z',
  };

  it('accepts a minimal Activity progress row without the activities join', () => {
    const result = progressRowSchema.safeParse(baseRow);
    expect(result.success).toBe(true);
  });

  it('accepts a row with the activities join populated', () => {
    const result = progressRowSchema.safeParse({
      ...baseRow,
      activities: { title: 'Math Adventure', category: 'math', difficulty: 'easy' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a legacy gameId row', () => {
    const result = progressRowSchema.safeParse({
      ...baseRow,
      activityId: undefined,
      gameId,
    });

    expect(result.success).toBe(false);
  });

  it('accepts nullable timestamps and jsonb data', () => {
    const result = progressRowSchema.safeParse({
      ...baseRow,
      status: null,
      score: null,
      attempts: null,
      timeSpent: null,
      lastPlayedAt: null,
      data: null,
      createdAt: null,
      updatedAt: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a row with non-UUID id', () => {
    const result = progressRowSchema.safeParse({ ...baseRow, id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects a row with non-integer score (matches DB INTEGER column)', () => {
    const result = progressRowSchema.safeParse({ ...baseRow, score: 97.5 });
    expect(result.success).toBe(false);
  });
});
