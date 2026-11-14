import { z } from 'zod';

/**
 * Nested student data joined into notification rows by GET list endpoint
 * via `select('*, students:student_id (id, username, avatar_url)')`.
 */
const notificationStudentJoinSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
});

/**
 * Public API entity shape for a `parent_notifications` row (camelCase,
 * after `camelCaseKeys`).
 *
 * `type` is a free string — the DB has no CHECK constraint and the set
 * of notification types grows over time. `data` is jsonb. The `students`
 * join is populated only by the list endpoint, so it is optional +
 * nullable.
 */
export const notificationRowSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid(),
  studentId: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  data: z.unknown().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  students: notificationStudentJoinSchema.nullable().optional(),
});
