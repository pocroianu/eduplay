import { z } from 'zod';
import {
  LEARNING_PATH_OWNER_KINDS,
  LEARNING_PATH_STATUSES,
  LEARNING_PATH_STEP_KINDS,
  STUDENT_PATH_PROGRESS_STATUSES,
} from '../types';

/**
 * Reusable UUID validator. The error string is generic on purpose — every
 * schema below tightens the message before exporting.
 */
const uuid = (msg: string) => z.string().uuid(msg);

const ageBound = z
  .number()
  .int('Vârsta trebuie să fie un număr întreg')
  .min(2, 'Vârsta minimă este 2 ani')
  .max(18, 'Vârsta maximă este 18 ani');

/**
 * Read shape for a single learning path row, post-mapping. Mirrors the
 * `LearningPath` interface in `../types` and is used by query Zod parsing
 * (defense-in-depth at the DB boundary, EDU-34 pattern).
 */
export const learningPathSchema = z.object({
  id: uuid('ID-ul parcursului este invalid'),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).nullable(),
  ageMin: z.number().int().nullable(),
  ageMax: z.number().int().nullable(),
  status: z.enum(LEARNING_PATH_STATUSES),
  ownerKind: z.enum(LEARNING_PATH_OWNER_KINDS),
  createdBy: uuid('ID-ul autorului este invalid'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type LearningPathSchemaShape = z.infer<typeof learningPathSchema>;

/**
 * Per-student progress row shape, post-mapping.
 */
export const studentPathProgressSchema = z.object({
  id: uuid('ID-ul progresului este invalid'),
  studentId: uuid('ID-ul elevului este invalid'),
  pathId: uuid('ID-ul parcursului este invalid'),
  currentStepId: uuid('ID-ul pasului curent este invalid').nullable(),
  lastCompletedStepId: uuid('ID-ul pasului finalizat este invalid').nullable(),
  status: z.enum(STUDENT_PATH_PROGRESS_STATUSES),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export type StudentPathProgressSchemaShape = z.infer<
  typeof studentPathProgressSchema
>;

/**
 * Input for creating a brand-new path (status defaults to `draft` server-side).
 *
 * Age bounds are optional but, when both supplied, must be ordered correctly —
 * the DB CHECK enforces this; we mirror it here so the failure surfaces in
 * Romanian instead of as a Postgres error.
 */
export const createPathInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, 'Titlul trebuie să aibă cel puțin 2 caractere')
      .max(120, 'Titlul nu poate depăși 120 de caractere'),
    description: z
      .string()
      .trim()
      .max(2000, 'Descrierea nu poate depăși 2000 de caractere')
      .nullable()
      .optional(),
    ageMin: ageBound.nullable().optional(),
    ageMax: ageBound.nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.ageMin == null || data.ageMax == null) return true;
      return data.ageMin <= data.ageMax;
    },
    {
      message: 'Vârsta minimă nu poate fi mai mare decât vârsta maximă',
      path: ['ageMin'],
    },
  );

export type CreatePathInput = z.infer<typeof createPathInputSchema>;

/**
 * Input for appending an Activity-template step to a path. The Activity-only
 * cutover removed legacy game-targeted path steps.
 */
export const addStepInputSchema = z
  .object({
    pathId: uuid('ID-ul parcursului este invalid'),
    kind: z.enum(LEARNING_PATH_STEP_KINDS),
    title: z
      .string()
      .trim()
      .min(2, 'Titlul pasului trebuie să aibă cel puțin 2 caractere')
      .max(120, 'Titlul pasului nu poate depăși 120 de caractere'),
    description: z
      .string()
      .trim()
      .max(2000, 'Descrierea pasului nu poate depăși 2000 de caractere')
      .nullable()
      .optional(),
    targetActivityType: z
      .string()
      .trim()
      .min(1, 'Tipul activității este obligatoriu')
      .max(80, 'Tipul activității nu poate depăși 80 de caractere')
      .nullable()
      .optional(),
    targetActivityConfig: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.targetActivityType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pașii de tip activitate trebuie să aibă un tip',
        path: ['targetActivityType'],
      });
    }
  });

export type AddStepInput = z.infer<typeof addStepInputSchema>;

export const reorderStepsInputSchema = z.object({
  pathId: uuid('ID-ul parcursului este invalid'),
  orderedStepIds: z.array(uuid('ID-ul pasului este invalid')),
});

export type ReorderStepsInput = z.infer<typeof reorderStepsInputSchema>;

/**
 * Input for assigning an existing path to either a class or a single
 * student. Class XOR student is enforced at the DB level via a CHECK
 * constraint; we surface the friendly message client-side.
 */
export const assignPathInputSchema = z
  .object({
    pathId: uuid('ID-ul parcursului este invalid'),
    classId: uuid('ID-ul clasei este invalid').nullable().optional(),
    studentId: uuid('ID-ul elevului este invalid').nullable().optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data scadentă trebuie să fie în format ISO')
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      const hasClass = data.classId != null;
      const hasStudent = data.studentId != null;
      return hasClass !== hasStudent;
    },
    {
      message:
        'Trebuie să atribui parcursul fie unei clase, fie unui elev — nu ambelor',
      path: ['classId'],
    },
  );

export type AssignPathInput = z.infer<typeof assignPathInputSchema>;

/**
 * Input for a teacher override of a student's path progress. Used by the
 * teacher's class-progress matrix to manually flip a row to `overridden` or
 * `completed` after an in-person assessment.
 */
export const overrideProgressInputSchema = z.object({
  studentId: uuid('ID-ul elevului este invalid'),
  pathId: uuid('ID-ul parcursului este invalid'),
  status: z.enum(['overridden', 'completed', 'in_progress']),
  currentStepId: uuid('ID-ul pasului curent este invalid').nullable().optional(),
});

export type OverrideProgressInput = z.infer<typeof overrideProgressInputSchema>;

/**
 * Input for a path id (used by `publishPath` and `advanceProgress`).
 */
export const pathIdSchema = z.object({
  pathId: uuid('ID-ul parcursului este invalid'),
});

export type PathIdInput = z.infer<typeof pathIdSchema>;

/**
 * Input for `advanceProgress`. Server-side only — the student session is
 * the source of truth for `studentId` (we re-derive it from `auth.uid()`
 * in the action), but tests pass it through explicitly.
 */
export const advanceProgressInputSchema = z.object({
  studentId: uuid('ID-ul elevului este invalid'),
  pathId: uuid('ID-ul parcursului este invalid'),
  completedStepId: uuid('ID-ul pasului finalizat este invalid'),
});

export type AdvanceProgressInput = z.infer<typeof advanceProgressInputSchema>;
