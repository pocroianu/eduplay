import { z } from 'zod';

const templates = [
  'multiple-choice',
  'matching-game',
  'memory-game',
  'categorize-game',
  'sequence-order',
  'tracing-game',
  'counting-game',
  'pattern-game',
  'repeat-sequence',
  'listen-tap',
  'free-response',
] as const;

const difficulties = ['easy', 'medium', 'hard'] as const;
const activityStatuses = [
  'draft',
  'in_review',
  'published',
  'archived',
] as const;
const activityVisibilityScopes = ['private', 'school', 'public'] as const;
const rendererKinds = ['iframe', 'react'] as const;
const authoringModes = ['admin-only', 'teacher-simple', 'hidden'] as const;

const languages = ['en', 'ro'] as const;

const activityTypeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Invalid activity type id');

const activityWriteSchema = z.object({
  template: z.enum(templates).optional(),
  typeId: activityTypeIdSchema.optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  thumbnailUrl: z.string().url().optional(),
  defaultLang: z.enum(languages).default('ro'),
  defaultTheme: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
  difficulty: z.enum(difficulties).default('easy'),
  targetAgeMin: z.number().int().min(2).max(18).optional(),
  targetAgeMax: z.number().int().min(2).max(18).optional(),
  estimatedDuration: z.number().int().min(1).optional(),
  questionCount: z.number().int().min(1).optional(),
  tags: z.array(z.string()).default([]),
  subject: z.string().max(50).optional(),
  skills: z.array(z.string()).default([]),
  isPublished: z.boolean().default(false),
  status: z.enum(activityStatuses).optional(),
  visibilityScope: z.enum(activityVisibilityScopes).optional(),
  configData: z.unknown().optional(),
  configSchemaVersion: z.number().int().min(1).optional(),
  revertVersionId: z.string().min(1).optional(),
});

export const createActivitySchema = activityWriteSchema.superRefine((value, ctx) => {
  if (!value.template && !value.typeId) {
    ctx.addIssue({
      code: 'custom',
      path: ['typeId'],
      message: 'Either typeId or template is required',
    });
  }

  if (value.template && value.typeId && value.template !== value.typeId) {
    ctx.addIssue({
      code: 'custom',
      path: ['typeId'],
      message: 'typeId must match template when both are provided',
    });
  }
});

export const updateActivitySchema = activityWriteSchema.partial().superRefine((value, ctx) => {
  if (value.template && value.typeId && value.template !== value.typeId) {
    ctx.addIssue({
      code: 'custom',
      path: ['typeId'],
      message: 'typeId must match template when both are provided',
    });
  }
});

export const createActivityVersionSchema = z.object({
  configData: z.unknown(),
});

export const previewActivitySchema = z.object({
  typeId: activityTypeIdSchema.optional(),
  configData: z.unknown(),
});

export const listActivitiesQuerySchema = z.object({
  template: z.enum(templates).optional(),
  typeId: activityTypeIdSchema.optional(),
  category: z.string().optional(),
  difficulty: z.enum(difficulties).optional(),
  subject: z.string().optional(),
  status: z.enum(activityStatuses).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  tag: z.string().optional(),
  published: z.enum(['true', 'false']).optional(),
  visibilityScope: z.enum(activityVisibilityScopes).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

export const activityTypeRowSchema = z.object({
  typeId: z.string(),
  displayName: z.string(),
  category: z.string(),
  configSchema: z.unknown(),
  rendererKey: z.string(),
  rendererKind: z.enum(rendererKinds),
  authoringMode: z.enum(authoringModes),
  producesSubmission: z.boolean(),
  supportsReview: z.boolean(),
  isAutoScored: z.boolean(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const activityVersionRowSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  activityId: z.string(),
  versionNumber: z.number().int(),
  configData: z.unknown(),
  configSchemaVersion: z.number().int(),
  activityTypeId: z.string(),
  publishedByUserId: z.string().nullable(),
  publishedAt: z.string().optional(),
});

export const activityRowSchema = z.object({
  id: z.string(),
  template: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  defaultLang: z.string(),
  defaultTheme: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  targetAgeMin: z.number().int().nullable().optional(),
  targetAgeMax: z.number().int().nullable().optional(),
  estimatedDuration: z.number().int().nullable().optional(),
  questionCount: z.number().int().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  subject: z.string().nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
  isPublished: z.boolean().nullable().optional(),
  status: z.string(),
  visibilityScope: z.enum(activityVisibilityScopes).nullable().optional(),
  configData: z.unknown().nullable().optional(),
  configSchemaVersion: z.number().int().nullable().optional(),
  createdBy: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

export type ActivityTypeRow = z.infer<typeof activityTypeRowSchema>;
export type ActivityVersionRow = z.infer<typeof activityVersionRowSchema>;
export type ActivityRow = z.infer<typeof activityRowSchema>;
