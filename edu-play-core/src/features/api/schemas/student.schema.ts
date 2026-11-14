import { z } from 'zod';

export const createStudentSchema = z.object({
  fullName: z.string().min(2).max(100),
  username: z.string().min(3).max(50),
  password: z.string().min(4).max(20),
  classId: z.string().uuid().optional(),
});

export const updateStudentSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  username: z.string().min(3).max(50).optional(),
  classId: z.string().uuid().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export const listStudentsQuerySchema = z.object({
  classId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * Public API entity shape for a student row (camelCase, after `camelCaseKeys`).
 *
 * `students` rows are typically merged with `profiles` columns (`fullName`,
 * `email`, `profileAvatarUrl`) before being returned, so the merged fields are
 * declared here — `optional` because POST returns a hand-built subset that
 * omits fields it does not have, and `nullable` because profile lookups can
 * legitimately miss. We validate types and presence to catch drift, not value
 * bounds.
 */
export const studentRowSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  classId: z.string().uuid().nullable(),
  parentId: z.string().uuid().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  profileAvatarUrl: z.string().nullable().optional(),
});

export type StudentRow = z.infer<typeof studentRowSchema>;
