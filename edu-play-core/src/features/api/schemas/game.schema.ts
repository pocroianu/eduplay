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

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type UpdateGameInput = z.infer<typeof updateGameSchema>;

/**
 * Public API entity shape for a game row (camelCase, after `camelCaseKeys`).
 *
 * This is intentionally permissive on dimensions we do not want to enforce at
 * read time — `category` is a free string (the DB has no CHECK constraint),
 * `learningObjectives` is `unknown` (jsonb), and timestamps are ISO strings.
 * Runtime row validation belongs at the query boundary; this is a type-only
 * contract for consumers of the legacy catalog API.
 */
export interface GameRow {
  id: string;
  title: string;
  description: string | null;
  gameUrl: string;
  thumbnailUrl: string | null;
  category: string | null;
  difficultyLevel: number | null;
  targetAgeMin: number | null;
  targetAgeMax: number | null;
  estimatedDuration: number | null;
  learningObjectives: unknown;
  isPublished: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
}
