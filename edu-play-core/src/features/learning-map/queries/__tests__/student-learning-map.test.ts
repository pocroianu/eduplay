import { describe, expect, it } from 'vitest';
import { mapActivePathToLearningMap } from '../student-learning-map';
import type { ActivePathForStudent, StudentPathStepView } from '@/features/learning-paths/server';

const PATH_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const COMPLETED_STEP_ID = '6ba7b811-9dad-41d1-80b4-00c04fd430c8';
const CURRENT_STEP_ID = '6ba7b812-9dad-41d1-80b4-00c04fd430c8';
const LOCKED_STEP_ID = '6ba7b813-9dad-41d1-80b4-00c04fd430c8';
const ACTIVITY_STEP_ID = '6ba7b817-9dad-41d1-80b4-00c04fd430c8';

function step(overrides: Partial<StudentPathStepView> = {}): StudentPathStepView {
  return {
    id: COMPLETED_STEP_ID,
    pathId: PATH_ID,
    stepOrder: 1,
    kind: 'activity_template',
    targetActivityType: 'drawing-canvas',
    targetActivityConfig: { mode: 'guided', prompt: 'Desenează o floare' },
    title: 'Numărăm până la 10',
    description: 'Joacă primul pas',
    createdAt: '2026-05-01T00:00:00.000Z',
    studentStatus: 'completed',
    ...overrides,
  };
}

function activePath(steps: StudentPathStepView[]): ActivePathForStudent {
  return {
    path: {
      id: PATH_ID,
      title: 'Aventura numerelor',
      description: 'O cale cu pași de matematică',
      ageMin: null,
      ageMax: null,
      status: 'published',
      ownerKind: 'teacher',
      createdBy: 'teacher-id',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
    progress: null,
    steps,
  };
}

describe('student learning map data', () => {
  it('maps active path steps into map stages with activity launcher links', () => {
    const result = mapActivePathToLearningMap(
      activePath([
        step(),
        step({
          id: CURRENT_STEP_ID,
          stepOrder: 2,
          title: 'Adunări simple',
          studentStatus: 'current',
        }),
        step({
          id: LOCKED_STEP_ID,
          stepOrder: 3,
          title: 'Scăderi simple',
          studentStatus: 'locked',
        }),
      ]),
    );

    expect(result.stages).toMatchObject([
      {
        id: COMPLETED_STEP_ID,
        name: 'Numărăm până la 10',
        status: 'completed',
        stageNumber: 1,
        lessons: [{ href: `/student/map/steps/${COMPLETED_STEP_ID}/launch` }],
      },
      {
        id: CURRENT_STEP_ID,
        name: 'Adunări simple',
        status: 'current',
        stageNumber: 2,
        lessons: [{ href: `/student/map/steps/${CURRENT_STEP_ID}/launch` }],
      },
      {
        id: LOCKED_STEP_ID,
        name: 'Scăderi simple',
        status: 'locked',
        stageNumber: 3,
      },
    ]);
    expect(result.overallProgress).toBe(33);
    expect(result.nextLesson).toMatchObject({
      id: CURRENT_STEP_ID,
      title: 'Adunări simple',
      href: `/student/map/steps/${CURRENT_STEP_ID}/launch`,
    });
  });

  it('routes activity-template steps through the server-only launcher', () => {
    const result = mapActivePathToLearningMap(
      activePath([
        step({
          id: ACTIVITY_STEP_ID,
          studentStatus: 'current',
        }),
      ]),
    );

    expect(result.stages[0]?.lessons[0]?.href).toBe(
      `/student/map/steps/${ACTIVITY_STEP_ID}/launch`,
    );
    expect(result.nextLesson?.href).toBe(
      `/student/map/steps/${ACTIVITY_STEP_ID}/launch`,
    );
  });

  it('does not expose a launcher CTA for stale or unsupported activity-template steps', () => {
    const result = mapActivePathToLearningMap(
      activePath([
        step({
          id: ACTIVITY_STEP_ID,
          targetActivityType: 'missing-activity-type',
          studentStatus: 'current',
        }),
      ]),
    );

    expect(result.stages[0]?.lessons[0]?.href).toBeUndefined();
    expect(result.nextLesson).toBeUndefined();
  });

  it('renders zero-based path step orders as one-based stage numbers', () => {
    const result = mapActivePathToLearningMap(
      activePath([
        step({
          id: CURRENT_STEP_ID,
          stepOrder: 0,
          studentStatus: 'current',
        }),
      ]),
    );

    expect(result.stages[0]?.stageNumber).toBe(1);
  });
});
