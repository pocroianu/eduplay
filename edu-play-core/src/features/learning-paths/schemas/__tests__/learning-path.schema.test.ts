import { describe, expect, it } from 'vitest';
import {
  addStepInputSchema,
  advanceProgressInputSchema,
  assignPathInputSchema,
  createPathInputSchema,
  learningPathSchema,
  overrideProgressInputSchema,
  pathIdSchema,
  studentPathProgressSchema,
} from '../learning-path.schema';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';

describe('learningPathSchema', () => {
  it('accepts a minimal valid row', () => {
    const parsed = learningPathSchema.parse({
      id: UUID_A,
      title: 'Aventura cititului',
      description: null,
      ageMin: null,
      ageMax: null,
      status: 'draft',
      ownerKind: 'teacher',
      createdBy: UUID_B,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    });
    expect(parsed.status).toBe('draft');
  });

  it('rejects an unknown status', () => {
    const result = learningPathSchema.safeParse({
      id: UUID_A,
      title: 't',
      description: null,
      ageMin: null,
      ageMax: null,
      status: 'pending',
      ownerKind: 'teacher',
      createdBy: UUID_B,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('studentPathProgressSchema', () => {
  it('accepts a not-started progress row', () => {
    const parsed = studentPathProgressSchema.parse({
      id: UUID_A,
      studentId: UUID_B,
      pathId: UUID_C,
      currentStepId: null,
      lastCompletedStepId: null,
      status: 'not_started',
      startedAt: null,
      completedAt: null,
      updatedAt: '2026-05-01T00:00:00Z',
    });
    expect(parsed.status).toBe('not_started');
  });

  it('rejects an unknown progress status', () => {
    const result = studentPathProgressSchema.safeParse({
      id: UUID_A,
      studentId: UUID_B,
      pathId: UUID_C,
      currentStepId: null,
      lastCompletedStepId: null,
      status: 'paused',
      startedAt: null,
      completedAt: null,
      updatedAt: '2026-05-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('createPathInputSchema', () => {
  it('accepts a minimal valid payload', () => {
    const parsed = createPathInputSchema.parse({ title: 'Aventura' });
    expect(parsed.title).toBe('Aventura');
  });

  it('rejects a too-short title', () => {
    const result = createPathInputSchema.safeParse({ title: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects a description over 2000 chars', () => {
    const result = createPathInputSchema.safeParse({
      title: 'Aventura',
      description: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects ageMin greater than ageMax', () => {
    const result = createPathInputSchema.safeParse({
      title: 'Aventura',
      ageMin: 10,
      ageMax: 6,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['ageMin']);
    }
  });

  it('accepts equal ageMin and ageMax', () => {
    const result = createPathInputSchema.safeParse({
      title: 'Aventura',
      ageMin: 7,
      ageMax: 7,
    });
    expect(result.success).toBe(true);
  });
});

describe('addStepInputSchema', () => {
  it('accepts an activity_template step', () => {
    const parsed = addStepInputSchema.parse({
      pathId: UUID_A,
      stepOrder: 1,
      kind: 'activity_template',
      title: 'Desen',
      targetActivityType: 'drawing-canvas',
      targetActivityConfig: { mode: 'free' },
    });
    expect(parsed.targetActivityType).toBe('drawing-canvas');
  });

  it('rejects an activity_template step missing targetActivityType', () => {
    const result = addStepInputSchema.safeParse({
      pathId: UUID_A,
      stepOrder: 1,
      kind: 'activity_template',
      title: 'Desen',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an append without caller-supplied ordering', () => {
    const result = addStepInputSchema.safeParse({
      pathId: '11111111-1111-4111-8111-111111111111',
      kind: 'activity_template',
      title: 'Pasul 1',
      targetActivityType: 'drawing-canvas',
    });
    expect(result.success).toBe(true);
  });
});

describe('assignPathInputSchema', () => {
  it('accepts a class assignment', () => {
    const parsed = assignPathInputSchema.parse({
      pathId: UUID_A,
      classId: UUID_B,
    });
    expect(parsed.classId).toBe(UUID_B);
  });

  it('accepts a student assignment with due date', () => {
    const parsed = assignPathInputSchema.parse({
      pathId: UUID_A,
      studentId: UUID_B,
      dueDate: '2026-06-01',
    });
    expect(parsed.studentId).toBe(UUID_B);
  });

  it('rejects when both classId and studentId are present', () => {
    const result = assignPathInputSchema.safeParse({
      pathId: UUID_A,
      classId: UUID_B,
      studentId: UUID_C,
    });
    expect(result.success).toBe(false);
  });

  it('rejects when neither classId nor studentId is present', () => {
    const result = assignPathInputSchema.safeParse({ pathId: UUID_A });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid due date format', () => {
    const result = assignPathInputSchema.safeParse({
      pathId: UUID_A,
      classId: UUID_B,
      dueDate: '01-06-2026',
    });
    expect(result.success).toBe(false);
  });
});

describe('overrideProgressInputSchema', () => {
  it('accepts an in_progress override with current step', () => {
    const parsed = overrideProgressInputSchema.parse({
      studentId: UUID_A,
      pathId: UUID_B,
      status: 'in_progress',
      currentStepId: UUID_C,
    });
    expect(parsed.status).toBe('in_progress');
  });

  it('rejects a not_started status (only mid-flight states allowed)', () => {
    const result = overrideProgressInputSchema.safeParse({
      studentId: UUID_A,
      pathId: UUID_B,
      status: 'not_started',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid student id', () => {
    const result = overrideProgressInputSchema.safeParse({
      studentId: 'not-a-uuid',
      pathId: UUID_B,
      status: 'completed',
    });
    expect(result.success).toBe(false);
  });
});

describe('pathIdSchema', () => {
  it('accepts a uuid pathId', () => {
    expect(pathIdSchema.parse({ pathId: UUID_A }).pathId).toBe(UUID_A);
  });

  it('rejects a non-uuid pathId', () => {
    const result = pathIdSchema.safeParse({ pathId: 'nope' });
    expect(result.success).toBe(false);
  });
});

describe('advanceProgressInputSchema', () => {
  it('accepts a complete payload', () => {
    const parsed = advanceProgressInputSchema.parse({
      studentId: UUID_A,
      pathId: UUID_B,
      completedStepId: UUID_C,
    });
    expect(parsed.completedStepId).toBe(UUID_C);
  });

  it('rejects a missing completedStepId', () => {
    const result = advanceProgressInputSchema.safeParse({
      studentId: UUID_A,
      pathId: UUID_B,
    });
    expect(result.success).toBe(false);
  });
});
