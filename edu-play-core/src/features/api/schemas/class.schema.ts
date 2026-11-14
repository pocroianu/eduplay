import { z } from 'zod';

const gradeLevels = ['preschool', 'kindergarten', 'grade-1', 'grade-2'] as const;

export const createClassSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  description: z.string().max(500, 'Description must be at most 500 characters').optional(),
  gradeLevel: z.enum(gradeLevels).optional(),
  schoolYear: z.string().max(20, 'School year must be at most 20 characters').optional(),
});

export const updateClassSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters').optional(),
  description: z.string().max(500, 'Description must be at most 500 characters').optional(),
  gradeLevel: z.enum(gradeLevels).optional(),
  schoolYear: z.string().max(20, 'School year must be at most 20 characters').optional(),
  isActive: z.boolean().optional(),
});

/**
 * Public API entity shape for a class row (camelCase, after `camelCaseKeys`).
 *
 * Permissive on bounds — `gradeLevel` is a free string (the DB has no CHECK
 * constraint) and timestamps are ISO strings. We validate types and presence
 * to catch drift, not value bounds.
 */
export const classRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  gradeLevel: z.string().nullable(),
  schoolYear: z.string().nullable(),
  isActive: z.boolean().nullable(),
  teacherId: z.string().uuid(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type ClassRow = z.infer<typeof classRowSchema>;
