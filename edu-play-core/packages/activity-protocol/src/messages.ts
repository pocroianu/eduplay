import { z } from 'zod';

const finiteNumberSchema = z.number().refine(Number.isFinite, {
  message: 'Expected a finite number',
});

const nonNegativeFiniteNumberSchema = finiteNumberSchema.refine((value) => value >= 0, {
  message: 'Expected a non-negative number',
});

const nonNegativeIntegerSchema = z.number().int().min(0);

const progressRatioSchema = finiteNumberSchema.refine((value) => value >= 0 && value <= 1, {
  message: 'Expected a progress ratio from 0 to 1',
});

const optionalNonEmptyStringSchema = z.string().min(1).optional();


export const gameControlActionSchema = z.union([
  z.literal('pause'),
  z.literal('resume'),
  z.literal('restart'),
  z.literal('mute'),
  z.literal('unmute'),
  z.literal('repeatInstruction'),
]);

export const activityReadyMessageSchema = z
  .object({
    type: z.literal('ACTIVITY_READY'),
    gameId: optionalNonEmptyStringSchema,
    capabilities: z
      .object({
        repeatInstruction: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const progressUpdateMessageSchema = z
  .object({
    type: z.literal('PROGRESS_UPDATE'),
    currentSet: nonNegativeIntegerSchema,
    totalSets: nonNegativeIntegerSchema,
    progress: progressRatioSchema,
  })
  .strict();

export const gameCompleteMessageSchema = z
  .object({
    type: z.literal('GAME_COMPLETE'),
    score: nonNegativeFiniteNumberSchema,
    totalSets: nonNegativeIntegerSchema,
    timeSpent: nonNegativeFiniteNumberSchema,
    reason: optionalNonEmptyStringSchema,
    starRating: z.number().int().min(1).max(3).optional(),
    screenshotDataUrl: z.string().optional(),
  })
  .strict();

export const gameToHostMessageSchema = z.discriminatedUnion('type', [
  activityReadyMessageSchema,
  progressUpdateMessageSchema,
  gameCompleteMessageSchema,
]);

export const activityInitMessageSchema = z
  .object({
    type: z.literal('ACTIVITY_INIT'),
    gameId: optionalNonEmptyStringSchema,
    activityId: optionalNonEmptyStringSchema,
    versionId: optionalNonEmptyStringSchema,
    assignmentId: optionalNonEmptyStringSchema,
    language: optionalNonEmptyStringSchema,
    studentId: optionalNonEmptyStringSchema,
    muted: z.boolean().optional(),
  })
  .strict();

export const gameControlMessageSchema = z
  .object({
    type: z.literal('GAME_CONTROL'),
    action: gameControlActionSchema,
  })
  .strict();

export const hostToGameMessageSchema = z.discriminatedUnion('type', [
  activityInitMessageSchema,
  gameControlMessageSchema,
]);

export type GameControlAction = z.infer<typeof gameControlActionSchema>;
export type ActivityReadyMessage = z.infer<typeof activityReadyMessageSchema>;
export type ProgressUpdateMessage = z.infer<typeof progressUpdateMessageSchema>;
export type GameCompleteMessage = z.infer<typeof gameCompleteMessageSchema>;
export type GameToHostMessage = z.infer<typeof gameToHostMessageSchema>;
export type ActivityInitMessage = z.infer<typeof activityInitMessageSchema>;
export type GameControlMessage = z.infer<typeof gameControlMessageSchema>;
export type HostToGameMessage = z.infer<typeof hostToGameMessageSchema>;

export type ParseProtocolMessageResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

export function parseGameToHostMessage(
  value: unknown,
): ParseProtocolMessageResult<GameToHostMessage> {
  const result = gameToHostMessageSchema.safeParse(value);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error };
}

export function parseHostToGameMessage(
  value: unknown,
): ParseProtocolMessageResult<HostToGameMessage> {
  const result = hostToGameMessageSchema.safeParse(value);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error };
}

export const ACTIVITY_PROTOCOL_FIXTURES = {
  gameToHost: {
    valid: [
      {
        type: 'ACTIVITY_READY',
        gameId: 'fruits-01',
        capabilities: { repeatInstruction: true },
      },
      {
        type: 'PROGRESS_UPDATE',
        currentSet: 2,
        totalSets: 10,
        progress: 0.2,
      },
      {
        type: 'GAME_COMPLETE',
        score: 8,
        totalSets: 10,
        timeSpent: 95,
        reason: 'completed',
        starRating: 2,
        screenshotDataUrl: 'data:image/png;base64,aGVsbG8=',
      },
    ],
    invalid: [
      { type: 'ACTIVITY_READY', capabilities: { repeatInstruction: 'yes' } },
      { type: 'PROGRESS_UPDATE', currentSet: 1, totalSets: 5, progress: 1.5 },
      { type: 'PROGRESS_UPDATE', currentSet: -1, totalSets: 5, progress: 0.5 },
      { type: 'GAME_COMPLETE', score: Number.NaN, totalSets: 10, timeSpent: 95 },
      { type: 'GAME_COMPLETE', score: 8, totalSets: 10, timeSpent: -1 },
      { type: 'GAME_COMPLETE', score: 8, totalSets: 10, timeSpent: 95, starRating: 4 },
      {
        type: 'GAME_COMPLETE',
        score: 8,
        totalSets: 10,
        timeSpent: 95,
        screenshotDataUrl: 123,
      },
      { type: 'UNKNOWN_MESSAGE' },
    ],
  },
  hostToGame: {
    valid: [
      {
        type: 'ACTIVITY_INIT',
        gameId: 'fruits-01',
        activityId: 'activity-1',
        versionId: 'version-1',
        assignmentId: 'assignment-1',
        language: 'ro',
        studentId: 'student-1',
        muted: false,
      },
      { type: 'GAME_CONTROL', action: 'pause' },
      { type: 'GAME_CONTROL', action: 'resume' },
      { type: 'GAME_CONTROL', action: 'restart' },
      { type: 'GAME_CONTROL', action: 'mute' },
      { type: 'GAME_CONTROL', action: 'unmute' },
      { type: 'GAME_CONTROL', action: 'repeatInstruction' },
    ],
    invalid: [
      {
        type: 'ACTIVITY_INIT',
        gameId: 'fruits-01',
        muted: false,
        configUrl: '/api/v1/activities/activity-1/config?versionId=version-1',
      },
      { type: 'GAME_CONTROL', action: 'skip' },
      { type: 'GAME_CONTROL' },
      { type: 'UNKNOWN_MESSAGE' },
    ],
  },
} as const;
