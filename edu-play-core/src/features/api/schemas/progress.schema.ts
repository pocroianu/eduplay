import { z } from 'zod';

const gameStatuses = ['not_started', 'in_progress', 'completed'] as const;

export const recordProgressSchema = z.object({
  studentId: z.string().uuid().optional(),
  activityId: z.string().uuid(),
  versionId: z.string().uuid().optional(),
  lastVersionId: z.string().uuid().optional(),
  assignmentId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  sequence: z.number().int().min(1).max(2147483647).optional(),
  status: z.enum(gameStatuses).default('in_progress'),
  score: z.number().int().min(0).optional(),
  timeSpent: z.number().int().min(0).max(2147483647).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}).superRefine((value, context) => {
  if (value.sessionId && (value.sequence === undefined || value.timeSpent === undefined || value.status === 'not_started')) {
    context.addIssue({ code: 'custom', message: 'Session progress requires sequence, elapsed time and an active status' });
  }
  if (value.sequence !== undefined && !value.sessionId) {
    context.addIssue({ code: 'custom', message: 'Sequence requires a play session' });
  }
});

export const listProgressQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  activityId: z.string().uuid().optional(),
  status: z.enum(gameStatuses).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export type RecordProgressInput = z.infer<typeof recordProgressSchema>;

const progressActivityJoinSchema = z.object({
  title: z.string(),
  category: z.string().nullable(),
  difficulty: z.string().nullable().optional(),
});

/**
 * Public API entity shape for learner progress rows (camelCase, after
 * `camelCaseKeys`). Rows are Activity-native and keyed by `activityId`.
 */
export const progressRowSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  activityId: z.string().uuid(),
  lastVersionId: z.string().uuid().nullable().optional(),
  status: z.string().nullable(),
  score: z.number().int().nullable(),
  attempts: z.number().int().nullable(),
  timeSpent: z.number().int().nullable(),
  completedAt: z.string().nullable(),
  lastPlayedAt: z.string().nullable(),
  data: z.unknown().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  activities: progressActivityJoinSchema.nullable().optional(),
});

export type ProgressRow = z.infer<typeof progressRowSchema>;
