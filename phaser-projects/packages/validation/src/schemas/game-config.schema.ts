/**
 * Game Configuration Schemas
 * Zod validation for Phaser educational games
 */

import { z } from 'zod';
import { hexColorSchema, themeConfigSchema, themeNameSchema } from './theme-config.schema';

// ============================================
// Language Schema
// ============================================

export const languageSchema = z.enum(['en', 'ro']);

// ============================================
// Game Type Schema
// ============================================

export const gameTypeSchema = z.enum([
  'multipleChoice',
  'matching',
  'memory',
  'categorize',
  'sequence',
  'tracing',
  'counting',
  'pattern',
  'repeat-sequence',
  'listen-tap'
]);

export type GameType = z.infer<typeof gameTypeSchema>;

// ============================================
// Choice Type Schema
// ============================================

export const choiceTypeSchema = z.enum(['text', 'image', 'audio']);

// ============================================
// Base Choice Schema (Language-Agnostic)
// ============================================

export const baseChoiceSchema = z.object({
  type: choiceTypeSchema,
  value: z.string().min(1),
  isCorrect: z.boolean()
});

// ============================================
// Base Question Schema (Language-Agnostic)
// ============================================

export const baseQuestionSchema = z.object({
  id: z.string().min(1),
  questionKey: z.string().min(1),
  audioKey: z.string().optional(),
  imageKey: z.string().optional(),
  choices: z.array(baseChoiceSchema)
    .min(2, 'Question must have at least 2 choices')
    .max(6, 'Question can have at most 6 choices')
    .refine(
      (choices) => choices.filter(c => c.isCorrect).length === 1,
      'Question must have exactly one correct answer'
    ),
  timeLimit: z.number().positive().optional(),
  points: z.number().positive().optional()
});

// ============================================
// Common Meta Fields (shared across all game types)
// ============================================

const commonMetaFields = {
  gameId: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (e.g., 1.0.0)'),
  totalSteps: z.number().int().positive(),
  themeName: themeNameSchema.optional(),
  theme: themeConfigSchema.partial().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  supportedLanguages: z.array(languageSchema).min(1)
};

// Per-template meta schemas. `.strict()` rejects unknown fields so typos
// (e.g. `themname` vs `themeName`) fail loudly in CI rather than silently
// being ignored at runtime.

const multipleChoiceMetaSchema = z
  .object({
    ...commonMetaFields,
    gameType: z.literal('multipleChoice'),
    shuffleQuestions: z.boolean().optional(),
    shuffleChoices: z.boolean().optional()
  })
  .strict();

const matchingMetaSchema = z
  .object({
    ...commonMetaFields,
    gameType: z.literal('matching'),
    shufflePairs: z.boolean().optional(),
    pointsPerPair: z.number().positive().optional(),
    penaltyPoints: z.number().nonnegative().optional()
  })
  .strict();

const memoryMetaSchema = z
  .object({
    ...commonMetaFields,
    gameType: z.literal('memory'),
    pointsPerPair: z.number().positive().optional(),
    flipBackDelay: z.number().positive().optional(),
    gridColumns: z.number().int().positive().optional()
  })
  .strict();

const categorizeMetaSchema = z
  .object({
    ...commonMetaFields,
    gameType: z.literal('categorize'),
    shuffleItems: z.boolean().optional(),
    pointsPerItem: z.number().positive().optional()
  })
  .strict();

const sequenceMetaSchema = z
  .object({
    ...commonMetaFields,
    gameType: z.literal('sequence'),
    shuffleItems: z.boolean().optional(),
    pointsPerItem: z.number().positive().optional()
  })
  .strict();

const tracingMetaSchema = z
  .object({
    ...commonMetaFields,
    gameType: z.literal('tracing'),
    pointsPerItem: z.number().positive().optional()
  })
  .strict();

const countingMetaSchema = z
  .object({
    ...commonMetaFields,
    gameType: z.literal('counting'),
    pointsPerRound: z.number().positive().optional(),
    roundDelay: z.number().nonnegative().optional(),
    defaultShape: z.string().min(1).optional(),
    defaultFillColor: hexColorSchema.optional(),
    defaultStrokeColor: hexColorSchema.optional()
  })
  .strict();

const patternMetaSchema = z
  .object({
    ...commonMetaFields,
    gameType: z.literal('pattern'),
    pointsPerRound: z.number().positive().optional(),
    roundDelay: z.number().nonnegative().optional(),
    defaultSize: z.string().min(1).optional()
  })
  .strict();

// Repeat-sequence configs are content-driven by `sequence.maxLength`, not by
// a fixed `totalSteps` like the older templates. Override the inherited
// `totalSteps` to be optional so authored configs that omit it still validate.
const repeatSequenceMetaSchema = z
  .object({
    ...commonMetaFields,
    totalSteps: z.number().int().positive().optional(),
    gameType: z.literal('repeat-sequence'),
    pointsPerRound: z.number().positive().optional(),
    roundDelay: z.number().nonnegative().optional()
  })
  .strict();

// Listen-tap configs follow the same shape conventions as repeat-sequence:
// content-driven (`rounds.length` is the source of truth) with the same
// optional pacing/scoring fields. `totalSteps` stays optional so transformer-
// generated configs (e.g. `wordListToGameConfig`) and bundled fixtures both
// validate.
const listenTapMetaSchema = z
  .object({
    ...commonMetaFields,
    totalSteps: z.number().int().nonnegative().optional(),
    gameType: z.literal('listen-tap'),
    pointsPerRound: z.number().positive().optional(),
    roundDelay: z.number().nonnegative().optional()
  })
  .strict();

// ============================================
// Per-Template Body Schemas
// ============================================

// Matching / Memory: pair-based
const pairSchema = z.object({
  id: z.string().min(1),
  imageKey: z.string().min(1),
  labelKey: z.string().min(1)
});

// Categorize: categories + items
const categorySchema = z.object({
  id: z.string().min(1),
  labelKey: z.string().min(1),
  color: z.string().optional()
});

const categorizeItemSchema = z.object({
  id: z.string().min(1),
  imageKey: z.string().min(1).optional(),
  labelKey: z.string().min(1),
  categoryId: z.string().min(1)
});

// Sequence: items with position
const sequenceItemSchema = z.object({
  id: z.string().min(1),
  labelKey: z.string().min(1),
  imageKey: z.string().optional(),
  position: z.number().int().positive()
});

// Tracing: items with strokes
const tracingStrokeSchema = z.object({
  path: z.string().min(1),
  checkpoints: z.number().int().positive()
});

const tracingItemSchema = z.object({
  id: z.string().min(1),
  labelKey: z.string().min(1),
  strokes: z.array(tracingStrokeSchema).min(1, 'Tracing item must define at least one stroke')
});

const tracingSettingsSchema = z.object({
  toleranceRadius: z.number().positive().optional(),
  checkpointSpacing: z.number().positive().optional(),
  pointsPerItem: z.number().positive().optional(),
  showGuideLabels: z.boolean().optional(),
  autoAdvanceDelay: z.number().nonnegative().optional()
}).partial();

// Counting: rounds describe how many objects to count per round.
const countingRoundSchema = z.object({
  id: z.string().min(1),
  count: z.number().int().positive()
});

// Pattern: tile dictionary keyed by single-letter ids referenced from `pattern`.
const patternTileSchema = z.object({
  shape: z.string().min(1),
  fillColor: hexColorSchema,
  size: z.string().min(1).optional()
});

const patternRoundSchema = z.object({
  id: z.string().min(1),
  pattern: z.string().min(1),
  gapCount: z.number().int().positive(),
  distractors: z.array(z.string().min(1)).optional()
});

// Repeat-sequence: pads array + sequence playback config.
const repeatSequencePadSchema = z.object({
  id: z.string().min(1),
  idleColor: hexColorSchema,
  litColor: hexColorSchema,
  frequency: z.number().positive(),
  glyph: z.string().min(1).optional()
});

const repeatSequenceSettingsSchema = z.object({
  startLength: z.number().int().positive(),
  maxLength: z.number().int().positive(),
  padLitMs: z.number().positive(),
  playbackGapMs: z.number().nonnegative(),
  introDelayMs: z.number().nonnegative().optional(),
  replayOnMiss: z.boolean().optional()
});

// Listen-tap: each round plays a prompt audio and asks the player to tap one
// of N image choices. `letter` is an optional overlay used by the phonics
// fixture; new authored configs may omit it.
const listenTapChoiceSchema = z.object({
  id: z.string().min(1),
  imageAssetId: z.string().min(1),
  correct: z.boolean(),
  letter: z.string().min(1).optional()
});

const listenTapRoundSchema = z.object({
  id: z.string().min(1),
  promptAudioId: z.string().min(1),
  choices: z
    .array(listenTapChoiceSchema)
    .min(1, 'Listen-tap round must have at least 1 choice')
    .max(6, 'Listen-tap round can have at most 6 choices')
    .refine(
      (choices) => choices.filter((c) => c.correct).length === 1,
      'Listen-tap round must have exactly one correct choice'
    )
});

// ============================================
// Per-Template Game Config Schemas
// ============================================

function addDuplicateIdIssues<T extends { id: string }>(
  entries: T[],
  ctx: z.RefinementCtx,
  arrayKey: string,
  entityLabel: string
): void {
  const seen = new Map<string, number>();
  entries.forEach((entry, idx) => {
    const prev = seen.get(entry.id);
    if (prev !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [arrayKey, idx, 'id'],
        message: `Duplicate ${entityLabel} id "${entry.id}" (also used at index ${prev})`
      });
    } else {
      seen.set(entry.id, idx);
    }
  });
}

export const multipleChoiceGameConfigSchema = z
  .object({
    meta: multipleChoiceMetaSchema,
    questions: z
      .array(baseQuestionSchema)
      .min(1, 'Multiple-choice config must have at least one question')
  })
  .superRefine((config, ctx) => {
    addDuplicateIdIssues(config.questions, ctx, 'questions', 'question');
  });

export const matchingGameConfigSchema = z
  .object({
    meta: matchingMetaSchema,
    pairs: z.array(pairSchema).min(2, 'Matching config must have at least 2 pairs'),
    questions: z.array(baseQuestionSchema).optional()
  })
  .superRefine((config, ctx) => {
    addDuplicateIdIssues(config.pairs, ctx, 'pairs', 'pair');
  });

export const memoryGameConfigSchema = z
  .object({
    meta: memoryMetaSchema,
    pairs: z.array(pairSchema).min(2, 'Memory config must have at least 2 pairs'),
    questions: z.array(baseQuestionSchema).optional()
  })
  .superRefine((config, ctx) => {
    addDuplicateIdIssues(config.pairs, ctx, 'pairs', 'pair');
  });

export const categorizeGameConfigSchema = z
  .object({
    meta: categorizeMetaSchema,
    categories: z
      .array(categorySchema)
      .min(2, 'Categorize config must have at least 2 categories'),
    items: z.array(categorizeItemSchema).min(1, 'Categorize config must have at least 1 item'),
    questions: z.array(baseQuestionSchema).optional()
  })
  .superRefine((config, ctx) => {
    addDuplicateIdIssues(config.categories, ctx, 'categories', 'category');
    addDuplicateIdIssues(config.items, ctx, 'items', 'item');
    const categoryIds = new Set(config.categories.map(c => c.id));
    config.items.forEach((item, idx) => {
      if (!categoryIds.has(item.categoryId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', idx, 'categoryId'],
          message: `Item references unknown categoryId "${item.categoryId}"`
        });
      }
    });
  });

export const sequenceGameConfigSchema = z
  .object({
    meta: sequenceMetaSchema,
    items: z.array(sequenceItemSchema).min(2, 'Sequence config must have at least 2 items'),
    questions: z.array(baseQuestionSchema).optional()
  })
  .superRefine((config, ctx) => {
    addDuplicateIdIssues(config.items, ctx, 'items', 'item');
    const positions = config.items.map(i => i.position);
    if (new Set(positions).size !== positions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'Sequence items must have unique position values'
      });
    }
  });

export const tracingGameConfigSchema = z
  .object({
    meta: tracingMetaSchema,
    settings: tracingSettingsSchema.optional(),
    items: z.array(tracingItemSchema).min(1, 'Tracing config must have at least 1 item'),
    questions: z.array(baseQuestionSchema).optional()
  })
  .superRefine((config, ctx) => {
    addDuplicateIdIssues(config.items, ctx, 'items', 'item');
  });

export const countingGameConfigSchema = z
  .object({
    meta: countingMetaSchema,
    rounds: z.array(countingRoundSchema).min(1, 'Counting config must have at least 1 round'),
    questions: z.array(baseQuestionSchema).optional()
  })
  .superRefine((config, ctx) => {
    addDuplicateIdIssues(config.rounds, ctx, 'rounds', 'round');
  });

export const patternGameConfigSchema = z
  .object({
    meta: patternMetaSchema,
    tiles: z.record(z.string().min(1), patternTileSchema)
      .refine((t) => Object.keys(t).length >= 2, {
        message: 'Pattern config must declare at least 2 tile entries'
      }),
    rounds: z.array(patternRoundSchema).min(1, 'Pattern config must have at least 1 round'),
    questions: z.array(baseQuestionSchema).optional()
  })
  .superRefine((config, ctx) => {
    addDuplicateIdIssues(config.rounds, ctx, 'rounds', 'round');
    const tileKeys = new Set(Object.keys(config.tiles));
    config.rounds.forEach((round, idx) => {
      const referenced = new Set([...round.pattern, ...(round.distractors ?? [])]);
      for (const key of referenced) {
        if (!tileKeys.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rounds', idx, 'pattern'],
            message: `Pattern round references unknown tile id "${key}"`
          });
        }
      }
    });
  });

export const repeatSequenceGameConfigSchema = z
  .object({
    meta: repeatSequenceMetaSchema,
    pads: z.array(repeatSequencePadSchema)
      .min(2, 'Repeat-sequence config must declare at least 2 pads'),
    sequence: repeatSequenceSettingsSchema,
    questions: z.array(baseQuestionSchema).optional()
  })
  .superRefine((config, ctx) => {
    addDuplicateIdIssues(config.pads, ctx, 'pads', 'pad');
    if (config.sequence.maxLength < config.sequence.startLength) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sequence', 'maxLength'],
        message: 'sequence.maxLength must be >= sequence.startLength'
      });
    }
  });

export const listenTapGameConfigSchema = z
  .object({
    meta: listenTapMetaSchema,
    rounds: z.array(listenTapRoundSchema).min(1, 'Listen-tap config must have at least 1 round'),
    questions: z.array(baseQuestionSchema).optional()
  })
  .superRefine((config, ctx) => {
    addDuplicateIdIssues(config.rounds, ctx, 'rounds', 'round');
    config.rounds.forEach((round, idx) => {
      addDuplicateIdIssues(round.choices, ctx, `rounds.${idx}.choices`, 'choice');
    });
  });

// ============================================
// Unified Game Config Dispatcher
// ============================================

// Zod's `discriminatedUnion` requires the discriminator key to be top-level,
// but our configs discriminate on `meta.gameType`. `parseGameConfig` below
// picks the right per-template schema based on that nested field so callers
// get a single entry point while per-template schemas stay authoritative.
const PER_TEMPLATE_SCHEMAS = {
  multipleChoice: multipleChoiceGameConfigSchema,
  matching: matchingGameConfigSchema,
  memory: memoryGameConfigSchema,
  categorize: categorizeGameConfigSchema,
  sequence: sequenceGameConfigSchema,
  tracing: tracingGameConfigSchema,
  counting: countingGameConfigSchema,
  pattern: patternGameConfigSchema,
  'repeat-sequence': repeatSequenceGameConfigSchema,
  'listen-tap': listenTapGameConfigSchema
} as const;

/**
 * Parse a game config by dispatching on `meta.gameType`. Missing `gameType`
 * defaults to `multipleChoice` for backward compatibility. Returns a typed
 * discriminated union on success so callers can narrow via `meta.gameType`.
 */
export function parseGameConfig(data: unknown): z.SafeParseReturnType<unknown, GameConfig> {
  const resolved = resolveGameType(data);
  if (!resolved.ok) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['meta', 'gameType'],
          message: resolved.reason
        }
      ])
    } as z.SafeParseError<unknown>;
  }
  const schema = PER_TEMPLATE_SCHEMAS[resolved.gameType];
  const normalized = withDefaultGameType(data, resolved.gameType);
  return schema.safeParse(normalized) as z.SafeParseReturnType<unknown, GameConfig>;
}

function withDefaultGameType(data: unknown, gameType: GameType): unknown {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return data;
  const v = data as { meta?: unknown; [k: string]: unknown };
  if (!v.meta || typeof v.meta !== 'object' || Array.isArray(v.meta)) return data;
  const meta = v.meta as { gameType?: unknown; [k: string]: unknown };
  if (typeof meta.gameType === 'string') return data;
  return { ...v, meta: { ...meta, gameType } };
}

function resolveGameType(
  data: unknown
): { ok: true; gameType: GameType } | { ok: false; reason: string } {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, reason: 'Config must be an object' };
  }
  const meta = (data as { meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    return { ok: false, reason: 'Config is missing a meta object' };
  }
  const rawGameType = (meta as { gameType?: unknown }).gameType;
  const gameType = typeof rawGameType === 'string' ? rawGameType : 'multipleChoice';
  const parsed = gameTypeSchema.safeParse(gameType);
  if (!parsed.success) {
    return {
      ok: false,
      reason: `Unknown meta.gameType "${gameType}" — expected one of: ${gameTypeSchema.options.join(', ')}`
    };
  }
  return { ok: true, gameType: parsed.data };
}

// ============================================
// Backward-compat: baseGameConfigSchema
// ============================================

/**
 * @deprecated Use `parseGameConfig` (dispatches per template) or
 * `multipleChoiceGameConfigSchema` explicitly. Kept as an alias for the
 * multiple-choice shape so existing consumers keep working.
 */
export const baseGameConfigSchema = multipleChoiceGameConfigSchema;

// ============================================
// Language Strings Schema
// ============================================

/**
 * Language strings file. Each template consumes a subset of these optional
 * dictionaries, so everything below `meta` is optional — template-specific
 * code knows which keys to read.
 */
export const gameStringsSchema = z.object({
  meta: z.object({
    title: z.string().min(1),
    description: z.string().optional()
  }),
  instruction: z.string().optional(),
  questions: z
    .record(
      z.string(),
      z.object({
        question: z.string().min(1),
        audio: z.string().optional()
      })
    )
    .optional(),
  choices: z.record(z.string(), z.string()).optional(),
  pairs: z.record(z.string(), z.string()).optional(),
  items: z.record(z.string(), z.string()).optional(),
  categories: z.record(z.string(), z.string()).optional()
}).passthrough();

// ============================================
// Hydrated Question Schema (Runtime)
// ============================================

export const hydratedQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.object({
    text: z.string().min(1),
    audio: z.string().optional(),
    image: z.string().optional()
  }),
  choices: z.array(z.object({
    type: choiceTypeSchema,
    value: z.string().min(1),
    isCorrect: z.boolean(),
    label: z.string().optional()
  }))
    .min(2)
    .max(6)
    .refine(
      (choices) => choices.filter(c => c.isCorrect).length === 1,
      'Question must have exactly one correct answer'
    ),
  timeLimit: z.number().positive().optional(),
  points: z.number().positive().optional()
});

// ============================================
// Hydrated Game Config Schema (Runtime)
// ============================================

export const hydratedGameConfigSchema = z.object({
  meta: z.object({
    gameId: z.string().min(1),
    version: z.string(),
    totalSteps: z.number().int().positive(),
    title: z.string().min(1),
    description: z.string().optional(),
    theme: themeConfigSchema,
    difficulty: z.enum(['easy', 'medium', 'hard']),
    shuffleQuestions: z.boolean(),
    shuffleChoices: z.boolean(),
    language: languageSchema
  }),
  questions: z.array(hydratedQuestionSchema).min(1)
});

// ============================================
// Game State Schemas
// ============================================

export const questionResultSchema = z.object({
  questionId: z.string(),
  selectedChoiceIndex: z.number().int().min(0),
  isCorrect: z.boolean(),
  timeSpent: z.number().optional(),
  attempts: z.number().int().positive()
});

export const gameStateSchema = z.object({
  currentQuestionIndex: z.number().int().min(0),
  score: z.number().min(0),
  results: z.array(questionResultSchema),
  startTime: z.number(),
  isComplete: z.boolean()
});

// ============================================
// Feedback Schemas
// ============================================

export const feedbackTypeSchema = z.enum(['correct', 'incorrect', 'timeout', 'hint']);

export const feedbackConfigSchema = z.object({
  type: feedbackTypeSchema,
  message: z.string().optional(),
  duration: z.number().positive().optional(),
  showParticles: z.boolean().optional(),
  playSound: z.boolean().optional()
});

// ============================================
// Animation Preset Schema
// ============================================

export const animationPresetSchema = z.object({
  scale: z.object({
    from: z.number(),
    to: z.number()
  }).optional(),
  duration: z.number().positive().optional(),
  ease: z.string().optional(),
  yoyo: z.boolean().optional(),
  repeat: z.number().int().min(-1).optional()
});

// ============================================
// Game Catalog Schemas
// ============================================

export const gameCatalogEntrySchema = z.object({
  id: z.string().min(1),
  gameType: gameTypeSchema.optional(),
  name: z.record(languageSchema, z.string()),
  description: z.record(languageSchema, z.string()).optional(),
  thumbnail: z.string().optional(),
  languages: z.array(languageSchema).min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  questionCount: z.number().int().positive().optional(),
  pairCount: z.number().int().positive().optional(),
  itemCount: z.number().int().positive().optional(),
  roundCount: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional()
}).refine(
  (entry) => [entry.questionCount, entry.pairCount, entry.itemCount, entry.roundCount].some(v => typeof v === 'number'),
  { message: 'Catalog entry must declare questionCount, pairCount, itemCount, or roundCount' }
);

export const gameCatalogSchema = z.object({
  version: z.string(),
  games: z.array(gameCatalogEntrySchema)
});

// ============================================
// Config Load Options Schema
// ============================================

export const configLoadOptionsSchema = z.object({
  gameId: z.string().min(1),
  language: languageSchema.optional(),
  baseUrl: z.string().optional(),
  configUrl: z.string().optional(),
  useCache: z.boolean().optional()
});

// ============================================
// Type Exports
// ============================================

export type Language = z.infer<typeof languageSchema>;
export type ChoiceType = z.infer<typeof choiceTypeSchema>;
export type BaseChoice = z.infer<typeof baseChoiceSchema>;
export type BaseQuestion = z.infer<typeof baseQuestionSchema>;
export type MultipleChoiceGameConfig = z.infer<typeof multipleChoiceGameConfigSchema>;
export type MatchingGameConfig = z.infer<typeof matchingGameConfigSchema>;
export type MemoryGameConfig = z.infer<typeof memoryGameConfigSchema>;
export type CategorizeGameConfig = z.infer<typeof categorizeGameConfigSchema>;
export type SequenceGameConfig = z.infer<typeof sequenceGameConfigSchema>;
export type TracingGameConfig = z.infer<typeof tracingGameConfigSchema>;
export type CountingGameConfig = z.infer<typeof countingGameConfigSchema>;
export type PatternGameConfig = z.infer<typeof patternGameConfigSchema>;
export type RepeatSequenceGameConfig = z.infer<typeof repeatSequenceGameConfigSchema>;
export type ListenTapGameConfig = z.infer<typeof listenTapGameConfigSchema>;
export type BaseGameConfig = MultipleChoiceGameConfig;
export type GameConfig =
  | MultipleChoiceGameConfig
  | MatchingGameConfig
  | MemoryGameConfig
  | CategorizeGameConfig
  | SequenceGameConfig
  | TracingGameConfig
  | CountingGameConfig
  | PatternGameConfig
  | RepeatSequenceGameConfig
  | ListenTapGameConfig;
export type GameStrings = z.infer<typeof gameStringsSchema>;
export type HydratedQuestion = z.infer<typeof hydratedQuestionSchema>;
export type HydratedGameConfig = z.infer<typeof hydratedGameConfigSchema>;
export type QuestionResult = z.infer<typeof questionResultSchema>;
export type GameState = z.infer<typeof gameStateSchema>;
export type FeedbackType = z.infer<typeof feedbackTypeSchema>;
export type FeedbackConfig = z.infer<typeof feedbackConfigSchema>;
export type AnimationPreset = z.infer<typeof animationPresetSchema>;
export type GameCatalogEntry = z.infer<typeof gameCatalogEntrySchema>;
export type GameCatalog = z.infer<typeof gameCatalogSchema>;
export type ConfigLoadOptions = z.infer<typeof configLoadOptionsSchema>;
