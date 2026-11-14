import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ActivePathForStudent, StudentPathStepView } from '@/features/learning-paths/server';
import type { ActivityTypeDefinition } from '@/features/activities';
import { runLaunchLearningMapStep } from '../launch-learning-map-step';
import { fakeClient, makeActivityInstanceRow } from '@/features/activities/queries/__tests__/fake-supabase';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const TEACHER_ID = '22222222-2222-4222-8222-222222222222';
const PATH_OWNER_ID = '33333333-3333-4333-8333-333333333333';
const CLASS_ID = '44444444-4444-4444-8444-444444444444';
const PATH_ID = '55555555-5555-4555-8555-555555555555';
const CURRENT_STEP_ID = '66666666-6666-4666-8666-666666666666';
const LOCKED_STEP_ID = '77777777-7777-4777-8777-777777777777';
const COMPLETED_STEP_ID = '88888888-8888-4888-8888-888888888888';
const INSTANCE_ID = '99999999-9999-4999-8999-999999999999';

const configSchema = z.object({
  promptText: z.string().min(1),
});

function activityDefinition(): ActivityTypeDefinition {
  return {
    typeId: 'drawing-canvas',
    displayName: 'Desen',
    icon: 'Pencil',
    configSchema,
    RendererComponent: (() => null) as ActivityTypeDefinition['RendererComponent'],
    resultCollector: vi.fn(),
  };
}

function pathStep(
  overrides: Partial<StudentPathStepView> = {},
): StudentPathStepView {
  return {
    id: CURRENT_STEP_ID,
    pathId: PATH_ID,
    stepOrder: 1,
    kind: 'activity_template',
    targetActivityType: 'drawing-canvas',
    targetActivityConfig: { promptText: 'Desenează o stea' },
    title: 'Desenăm forme',
    description: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    studentStatus: 'current',
    ...overrides,
  };
}

function activePath(
  steps: StudentPathStepView[] = [pathStep()],
): ActivePathForStudent {
  return {
    path: {
      id: PATH_ID,
      title: 'Aventura creativă',
      description: null,
      ageMin: null,
      ageMax: null,
      status: 'published',
      ownerKind: 'teacher',
      createdBy: PATH_OWNER_ID,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
    progress: null,
    steps,
  };
}

function makeDeps({
  path = activePath(),
  existingInstance = null,
  createdInstance = makeActivityInstanceRow({ id: INSTANCE_ID }),
  definition = activityDefinition(),
}: {
  path?: ActivePathForStudent | null;
  existingInstance?: ReturnType<typeof makeActivityInstanceRow> | null;
  createdInstance?: ReturnType<typeof makeActivityInstanceRow>;
  definition?: ActivityTypeDefinition | undefined;
} = {}) {
  const session = fakeClient({
    perTable: {
      profiles: [{ data: { id: STUDENT_ID, role: 'student' }, error: null }],
      students: [{ data: { class_id: CLASS_ID }, error: null }],
      learning_path_assignments: [
        { data: { assigned_by: TEACHER_ID }, error: null },
      ],
    },
  });
  const admin = fakeClient({
    perTable: {
      activity_instances: [
        { data: existingInstance, error: null },
        { data: createdInstance, error: null },
      ],
    },
  });

  return {
    session,
    admin,
    deps: {
      supabase: session.client,
      adminSupabase: admin.client,
      studentId: STUDENT_ID,
      stepId: CURRENT_STEP_ID,
      getActivePath: vi.fn(async () => path),
      getActivityType: vi.fn(() => definition),
    },
  };
}

describe('runLaunchLearningMapStep', () => {
  it('creates an activity instance for the current activity-template step with server-derived values', async () => {
    const { deps, admin } = makeDeps();

    const result = await runLaunchLearningMapStep(deps);

    expect(result).toEqual({
      href: `/student/activities/${INSTANCE_ID}/play`,
    });
    const insert = admin.trace.calls.find((call) => call.fn === 'insert');
    expect(insert?.args[0]).toMatchObject({
      type_id: 'drawing-canvas',
      config: { promptText: 'Desenează o stea' },
      assigned_to: STUDENT_ID,
      class_id: CLASS_ID,
      created_by: TEACHER_ID,
      source_learning_path_step_id: CURRENT_STEP_ID,
    });
  });

  it('returns the existing instance href without inserting on idempotent relaunch', async () => {
    const existing = makeActivityInstanceRow({ id: INSTANCE_ID });
    const { deps, admin } = makeDeps({ existingInstance: existing });

    const result = await runLaunchLearningMapStep(deps);

    expect(result?.href).toBe(`/student/activities/${INSTANCE_ID}/play`);
    expect(admin.trace.calls.some((call) => call.fn === 'insert')).toBe(false);
  });

  it('rejects locked and foreign steps before admin writes', async () => {
    const { deps, admin } = makeDeps({
      path: activePath([
        pathStep({ id: LOCKED_STEP_ID, studentStatus: 'locked' }),
      ]),
    });

    const result = await runLaunchLearningMapStep({
      ...deps,
      stepId: LOCKED_STEP_ID,
    });

    expect(result).toBeNull();
    expect(admin.fromCalls).toHaveLength(0);
  });

  it('rejects invalid activity config without creating an instance', async () => {
    const { deps, admin } = makeDeps({
      path: activePath([
        pathStep({
          targetActivityConfig: { promptText: '' },
        }),
      ]),
    });

    const result = await runLaunchLearningMapStep(deps);

    expect(result).toBeNull();
    expect(admin.trace.calls.some((call) => call.fn === 'insert')).toBe(false);
  });

  it('replays an existing completed-step instance but does not create a new completed instance', async () => {
    const existing = makeActivityInstanceRow({ id: INSTANCE_ID });
    const { deps, admin } = makeDeps({
      path: activePath([
        pathStep({ id: COMPLETED_STEP_ID, studentStatus: 'completed' }),
      ]),
      existingInstance: existing,
    });

    const result = await runLaunchLearningMapStep({
      ...deps,
      stepId: COMPLETED_STEP_ID,
    });

    expect(result?.href).toBe(`/student/activities/${INSTANCE_ID}/play`);
    expect(admin.trace.calls.some((call) => call.fn === 'insert')).toBe(false);
  });

  it('returns null when a completed step has no existing instance to replay', async () => {
    const { deps, admin } = makeDeps({
      path: activePath([
        pathStep({ id: COMPLETED_STEP_ID, studentStatus: 'completed' }),
      ]),
      existingInstance: null,
    });

    const result = await runLaunchLearningMapStep({
      ...deps,
      stepId: COMPLETED_STEP_ID,
    });

    expect(result).toBeNull();
    expect(admin.trace.calls.some((call) => call.fn === 'insert')).toBe(false);
  });
});
