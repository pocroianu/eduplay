import { describe, it, expect } from 'vitest';
import { notificationRowSchema } from '../notification.schema';

describe('notificationRowSchema', () => {
  const baseRow = {
    id: '11111111-1111-4111-8111-111111111111',
    parentId: '22222222-2222-4222-8222-222222222222',
    studentId: '33333333-3333-4333-8333-333333333333',
    type: 'artifact_published',
    title: 'Lucrare nouă',
    message: 'Copilul tău a publicat o lucrare.',
    data: { artifactId: '44444444-4444-4444-8444-444444444444' },
    readAt: null,
    createdAt: '2026-05-03T10:00:00.000Z',
  };

  it('accepts a minimal unread row without the students join', () => {
    const result = notificationRowSchema.safeParse(baseRow);
    expect(result.success).toBe(true);
  });

  it('accepts a row with the students join populated (GET list shape)', () => {
    const result = notificationRowSchema.safeParse({
      ...baseRow,
      students: {
        id: '33333333-3333-4333-8333-333333333333',
        username: 'maria',
        avatarUrl: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a row with readAt set and null jsonb data', () => {
    const result = notificationRowSchema.safeParse({
      ...baseRow,
      data: null,
      readAt: '2026-05-03T11:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a row with non-UUID parentId', () => {
    const result = notificationRowSchema.safeParse({ ...baseRow, parentId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects a row missing required title', () => {
    const { title: _omit, ...rest } = baseRow;
    const result = notificationRowSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
