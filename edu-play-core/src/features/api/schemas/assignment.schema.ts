import { z } from 'zod';

export const createAssignmentSchema = z
  .object({
    activityId: z.string().uuid(),
    classId: z.string().uuid().optional(),
    studentId: z.string().uuid().optional(),
    studentIds: z.array(z.string().uuid()).min(1).optional(),
    dueDate: z.string().datetime().optional(),
    isMandatory: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    const targets = [
      data.classId,
      data.studentId,
      data.studentIds && data.studentIds.length > 0 ? data.studentIds : undefined,
    ].filter(Boolean);

    if (targets.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Exactly one of classId, studentId, or studentIds must be provided',
        path: ['classId'],
      });
    }

    if (data.studentIds && new Set(data.studentIds).size !== data.studentIds.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'studentIds must not contain duplicates',
        path: ['studentIds'],
      });
    }
  });

export const updateAssignmentSchema = z.object({
  dueDate: z.string().datetime().nullable().optional(),
  isMandatory: z.boolean().optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

const assignmentActivityJoinSchema = z.object({
  title: z.string(),
  category: z.string().nullable(),
  difficulty: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
});

/**
 * Public API entity shape for an assignment row (camelCase, after
 * `camelCaseKeys`).
 *
 * The `activities` join is populated by list/detail GET endpoints but omitted
 * by POST/PATCH (which `select()` the bare row), so it is `optional` and
 * `nullable`. Timestamps are ISO strings; we validate types and presence to
 * catch drift, not value bounds.
 */
export const assignmentRowSchema = z.object({
  id: z.string().uuid(),
  activityId: z.string().uuid(),
  classId: z.string().uuid().nullable(),
  studentId: z.string().uuid().nullable(),
  teacherId: z.string().uuid(),
  versionId: z.string().uuid(),
  dueDate: z.string().nullable(),
  isMandatory: z.boolean().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  activities: assignmentActivityJoinSchema.nullable().optional(),
});

export type AssignmentRow = z.infer<typeof assignmentRowSchema>;
