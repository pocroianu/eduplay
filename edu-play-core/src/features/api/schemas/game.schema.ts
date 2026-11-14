import { z } from 'zod';

const gameCategories = [
  'literacy',
  'math',
  'phonics',
  'shapes',
  'colors',
  'vocabulary',
] as const;

export const createGameSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  thumbnailUrl: z.string().url().optional(),
  gameUrl: z.string().min(1),
  category: z.enum(gameCategories).optional(),
  difficultyLevel: z.number().int().min(1).max(5).optional(),
  targetAgeMin: z.number().int().min(2).max(18).optional(),
  targetAgeMax: z.number().int().min(2).max(18).optional(),
  estimatedDuration: z.number().int().min(1).optional(),
  learningObjectives: z.record(z.string(), z.unknown()).optional(),
  isPublished: z.boolean().default(false),
});

export const updateGameSchema = createGameSchema.partial();

const listGamesQuerySchema = z.object({
  category: z.enum(gameCategories).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  published: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type UpdateGameInput = z.infer<typeof updateGameSchema>;

/**
 * Public API entity shape for a game row (camelCase, after `camelCaseKeys`).
 *
 * This is intentionally permissive on dimensions we do not want to enforce at
 * read time — `category` is a free string (the DB has no CHECK constraint),
 * `learningObjectives` is `unknown` (jsonb), and timestamps are ISO strings.
 * We validate types and presence to catch drift, not value bounds.
 */
const gameRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  gameUrl: z.string(),
  thumbnailUrl: z.string().nullable(),
  category: z.string().nullable(),
  difficultyLevel: z.number().int().nullable(),
  targetAgeMin: z.number().int().nullable(),
  targetAgeMax: z.number().int().nullable(),
  estimatedDuration: z.number().int().nullable(),
  learningObjectives: z.unknown().nullable(),
  isPublished: z.boolean().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type GameRow = z.infer<typeof gameRowSchema>;
