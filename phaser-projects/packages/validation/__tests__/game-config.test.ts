/**
 * Game Config Schema Tests
 * Verify validation works with real game configurations.
 */

import { describe, it, expect } from 'vitest';
import {
  baseGameConfigSchema,
  multipleChoiceGameConfigSchema,
  matchingGameConfigSchema,
  memoryGameConfigSchema,
  categorizeGameConfigSchema,
  sequenceGameConfigSchema,
  tracingGameConfigSchema,
  countingGameConfigSchema,
  patternGameConfigSchema,
  repeatSequenceGameConfigSchema,
  listenTapGameConfigSchema,
  gameCatalogSchema,
  gameStringsSchema,
  baseQuestionSchema,
  configLoadOptionsSchema,
  parseGameConfig
} from '../src/schemas/game-config.schema';

describe('Game Config Validation', () => {
  describe('baseQuestionSchema', () => {
    it('should validate a valid question', () => {
      const validQuestion = {
        id: 'q1',
        questionKey: 'q1.question',
        audioKey: 'question1',
        choices: [
          { type: 'image', value: 'banana', isCorrect: false },
          { type: 'image', value: 'apple', isCorrect: true },
          { type: 'image', value: 'carrot', isCorrect: false }
        ]
      };

      const result = baseQuestionSchema.safeParse(validQuestion);
      expect(result.success).toBe(true);
    });

    it('should reject question with no correct answer', () => {
      const invalidQuestion = {
        id: 'q1',
        questionKey: 'q1.question',
        choices: [
          { type: 'image', value: 'banana', isCorrect: false },
          { type: 'image', value: 'apple', isCorrect: false }
        ]
      };

      const result = baseQuestionSchema.safeParse(invalidQuestion);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('exactly one correct answer');
      }
    });

    it('should reject question with multiple correct answers', () => {
      const invalidQuestion = {
        id: 'q1',
        questionKey: 'q1.question',
        choices: [
          { type: 'image', value: 'banana', isCorrect: true },
          { type: 'image', value: 'apple', isCorrect: true }
        ]
      };

      const result = baseQuestionSchema.safeParse(invalidQuestion);
      expect(result.success).toBe(false);
    });

    it('should reject question with too few choices', () => {
      const invalidQuestion = {
        id: 'q1',
        questionKey: 'q1.question',
        choices: [
          { type: 'image', value: 'apple', isCorrect: true }
        ]
      };

      const result = baseQuestionSchema.safeParse(invalidQuestion);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('at least 2 choices');
      }
    });

    it('should reject question with too many choices', () => {
      const invalidQuestion = {
        id: 'q1',
        questionKey: 'q1.question',
        choices: Array(7).fill(null).map((_, i) => ({
          type: 'image',
          value: `choice${i}`,
          isCorrect: i === 0
        }))
      };

      const result = baseQuestionSchema.safeParse(invalidQuestion);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('at most 6 choices');
      }
    });
  });

  describe('multipleChoiceGameConfigSchema', () => {
    it('should validate a fruits-01-style config with explicit gameType', () => {
      const config = {
        meta: {
          gameId: 'fruits-01',
          version: '1.0.0',
          totalSteps: 3,
          gameType: 'multipleChoice',
          difficulty: 'easy',
          shuffleQuestions: false,
          shuffleChoices: false,
          supportedLanguages: ['en', 'ro'],
          themeName: 'ocean'
        },
        questions: [
          {
            id: 'q1',
            questionKey: 'q1.question',
            audioKey: 'question1',
            choices: [
              { type: 'image', value: 'banana', isCorrect: false },
              { type: 'image', value: 'apple', isCorrect: true },
              { type: 'image', value: 'carrot', isCorrect: false }
            ]
          }
        ]
      };

      const result = multipleChoiceGameConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid version format', () => {
      const invalidConfig = {
        meta: {
          gameId: 'test-01',
          version: '1.0',
          totalSteps: 3,
          gameType: 'multipleChoice',
          supportedLanguages: ['en']
        },
        questions: [
          {
            id: 'q1',
            questionKey: 'q1.question',
            choices: [
              { type: 'text', value: 'a', isCorrect: false },
              { type: 'text', value: 'b', isCorrect: true }
            ]
          }
        ]
      };

      const result = multipleChoiceGameConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject config with no questions', () => {
      const invalidConfig = {
        meta: {
          gameId: 'test-01',
          version: '1.0.0',
          totalSteps: 3,
          gameType: 'multipleChoice',
          supportedLanguages: ['en']
        },
        questions: []
      };

      const result = multipleChoiceGameConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('baseGameConfigSchema (backward-compat alias)', () => {
    it('should still accept the multiple-choice shape with explicit gameType', () => {
      const legacy = {
        meta: {
          gameId: 'fruits-01',
          version: '1.0.0',
          totalSteps: 3,
          gameType: 'multipleChoice',
          supportedLanguages: ['en']
        },
        questions: [
          {
            id: 'q1',
            questionKey: 'q1.question',
            choices: [
              { type: 'text', value: 'a', isCorrect: false },
              { type: 'text', value: 'b', isCorrect: true }
            ]
          }
        ]
      };
      const result = baseGameConfigSchema.safeParse(legacy);
      expect(result.success).toBe(true);
    });
  });

  describe('matchingGameConfigSchema', () => {
    const config = {
      meta: {
        gameId: 'animals-match-01',
        version: '1.0.0',
        totalSteps: 4,
        gameType: 'matching',
        shufflePairs: true,
        themeName: 'nature',
        pointsPerPair: 10,
        penaltyPoints: 2,
        supportedLanguages: ['en', 'ro']
      },
      pairs: [
        { id: 'p1', imageKey: 'cat', labelKey: 'p1.label' },
        { id: 'p2', imageKey: 'frog', labelKey: 'p2.label' },
        { id: 'p3', imageKey: 'elephant', labelKey: 'p3.label' },
        { id: 'p4', imageKey: 'lion', labelKey: 'p4.label' }
      ],
      questions: []
    };

    it('should validate a shipped matching-game config with empty questions array', () => {
      const result = matchingGameConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject a matching config missing the pairs array', () => {
      const result = matchingGameConfigSchema.safeParse({
        ...config,
        pairs: undefined
      });
      expect(result.success).toBe(false);
    });

    it('should reject a matching config with fewer than 2 pairs', () => {
      const result = matchingGameConfigSchema.safeParse({
        ...config,
        pairs: [{ id: 'p1', imageKey: 'cat', labelKey: 'p1.label' }]
      });
      expect(result.success).toBe(false);
    });
  });

  describe('memoryGameConfigSchema', () => {
    it('should validate a memory-game config', () => {
      const config = {
        meta: {
          gameId: 'food-memory-01',
          version: '1.0.0',
          totalSteps: 1,
          gameType: 'memory',
          themeName: 'candy',
          pointsPerPair: 10,
          flipBackDelay: 1500,
          gridColumns: 4,
          supportedLanguages: ['en', 'ro']
        },
        pairs: [
          { id: 'p1', imageKey: 'apple', labelKey: 'pair.apple' },
          { id: 'p2', imageKey: 'banana', labelKey: 'pair.banana' }
        ],
        questions: []
      };

      const result = memoryGameConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('categorizeGameConfigSchema', () => {
    const validConfig = {
      meta: {
        gameId: 'animals-habitat-01',
        version: '1.0.0',
        totalSteps: 1,
        gameType: 'categorize',
        themeName: 'nature',
        pointsPerItem: 10,
        shuffleItems: true,
        supportedLanguages: ['en', 'ro']
      },
      categories: [
        { id: 'farm', labelKey: 'cat.farm', color: '#4CAF50' },
        { id: 'wild', labelKey: 'cat.wild', color: '#FF9800' }
      ],
      items: [
        { id: 'i1', imageKey: 'cat', labelKey: 'item.cat', categoryId: 'farm' },
        { id: 'i2', imageKey: 'lion', labelKey: 'item.lion', categoryId: 'wild' }
      ],
      questions: []
    };

    it('should validate a categorize-game config', () => {
      const result = categorizeGameConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject an item referencing an unknown categoryId', () => {
      const broken = {
        ...validConfig,
        items: [
          { id: 'i1', imageKey: 'cat', labelKey: 'item.cat', categoryId: 'farm' },
          { id: 'i2', imageKey: 'lion', labelKey: 'item.lion', categoryId: 'ocean' }
        ]
      };
      const result = categorizeGameConfigSchema.safeParse(broken);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(i =>
            typeof i.message === 'string' && i.message.includes('unknown categoryId')
          )
        ).toBe(true);
      }
    });
  });

  describe('sequenceGameConfigSchema', () => {
    const validConfig = {
      meta: {
        gameId: 'numbers-1-to-6',
        version: '1.0.0',
        totalSteps: 1,
        gameType: 'sequence',
        themeName: 'nature',
        pointsPerItem: 10,
        shuffleItems: true,
        supportedLanguages: ['en', 'ro']
      },
      items: [
        { id: 'i1', labelKey: 'item.1', position: 1 },
        { id: 'i2', labelKey: 'item.2', position: 2 },
        { id: 'i3', labelKey: 'item.3', position: 3 }
      ],
      questions: []
    };

    it('should validate a sequence-order config', () => {
      const result = sequenceGameConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject duplicate positions', () => {
      const broken = {
        ...validConfig,
        items: [
          { id: 'i1', labelKey: 'item.1', position: 1 },
          { id: 'i2', labelKey: 'item.2', position: 1 }
        ]
      };
      const result = sequenceGameConfigSchema.safeParse(broken);
      expect(result.success).toBe(false);
    });
  });

  describe('tracingGameConfigSchema', () => {
    const validConfig = {
      meta: {
        gameId: 'shapes-basic',
        version: '1.0.0',
        totalSteps: 4,
        gameType: 'tracing',
        themeName: 'candy',
        supportedLanguages: ['en', 'ro']
      },
      settings: {
        toleranceRadius: 45,
        checkpointSpacing: 25,
        pointsPerItem: 10,
        showGuideLabels: true,
        autoAdvanceDelay: 1500
      },
      items: [
        {
          id: 'circle',
          labelKey: 'item.circle',
          strokes: [
            { path: 'M100,10 L190,100 L100,190 L10,100 Z', checkpoints: 12 }
          ]
        }
      ],
      questions: []
    };

    it('should validate a tracing-game config with settings and strokes', () => {
      const result = tracingGameConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject tracing items without strokes', () => {
      const broken = {
        ...validConfig,
        items: [{ id: 'circle', labelKey: 'item.circle', strokes: [] }]
      };
      const result = tracingGameConfigSchema.safeParse(broken);
      expect(result.success).toBe(false);
    });
  });

  describe('countingGameConfigSchema', () => {
    const validCounting = {
      meta: {
        gameId: 'farm-count-01',
        version: '1.0.0',
        totalSteps: 5,
        gameType: 'counting',
        themeName: 'nature',
        pointsPerRound: 10,
        roundDelay: 900,
        supportedLanguages: ['ro', 'en'],
        defaultShape: 'circle',
        defaultFillColor: 16758605,
        defaultStrokeColor: 15028480
      },
      rounds: [
        { id: 'r1', count: 2 },
        { id: 'r2', count: 4 },
        { id: 'r3', count: 1 }
      ],
      questions: []
    };

    it('should validate a counting-game config matching the farm-count fixture', () => {
      const result = countingGameConfigSchema.safeParse(validCounting);
      expect(result.success).toBe(true);
    });

    it('should reject a counting config with duplicate round ids', () => {
      const dup = {
        ...validCounting,
        rounds: [
          { id: 'r1', count: 2 },
          { id: 'r1', count: 4 }
        ]
      };
      const result = countingGameConfigSchema.safeParse(dup);
      expect(result.success).toBe(false);
    });

    it('should reject a counting config with non-positive count', () => {
      const bad = {
        ...validCounting,
        rounds: [{ id: 'r1', count: 0 }]
      };
      const result = countingGameConfigSchema.safeParse(bad);
      expect(result.success).toBe(false);
    });
  });

  describe('patternGameConfigSchema', () => {
    const validPattern = {
      meta: {
        gameId: 'shapes-pattern-01',
        version: '1.0.0',
        totalSteps: 5,
        gameType: 'pattern',
        themeName: 'ocean',
        pointsPerRound: 10,
        roundDelay: 900,
        supportedLanguages: ['ro', 'en'],
        defaultSize: 'medium'
      },
      tiles: {
        A: { shape: 'circle', fillColor: 16738407, size: 'medium' },
        B: { shape: 'square', fillColor: 5163204, size: 'medium' }
      },
      rounds: [
        { id: 'r1', pattern: 'ABAB', gapCount: 1 },
        { id: 'r2', pattern: 'AABBAABB', gapCount: 2 }
      ],
      questions: []
    };

    it('should validate a pattern-game config matching the shapes-pattern fixture', () => {
      const result = patternGameConfigSchema.safeParse(validPattern);
      expect(result.success).toBe(true);
    });

    it('should reject a pattern config that references an unknown tile id', () => {
      const bad = {
        ...validPattern,
        rounds: [{ id: 'r1', pattern: 'ABCABC', gapCount: 1 }]
      };
      const result = patternGameConfigSchema.safeParse(bad);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes('unknown tile id'))).toBe(true);
      }
    });

    it('should reject a pattern config with fewer than 2 tiles', () => {
      const bad = {
        ...validPattern,
        tiles: { A: { shape: 'circle', fillColor: 16738407 } }
      };
      const result = patternGameConfigSchema.safeParse(bad);
      expect(result.success).toBe(false);
    });
  });

  describe('repeatSequenceGameConfigSchema', () => {
    const validRepeat = {
      meta: {
        gameId: 'animals-sequence-01',
        version: '1.0.0',
        gameType: 'repeat-sequence',
        themeName: 'forest',
        pointsPerRound: 10,
        roundDelay: 900,
        supportedLanguages: ['ro', 'en']
      },
      pads: [
        { id: 'dog', idleColor: 9847900, litColor: 14594196, frequency: 293.66, glyph: 'pawprint' },
        { id: 'cat', idleColor: 13724600, litColor: 16756851, frequency: 369.99, glyph: 'circle' }
      ],
      sequence: {
        startLength: 3,
        maxLength: 8,
        padLitMs: 560,
        playbackGapMs: 200,
        introDelayMs: 1000,
        replayOnMiss: false
      },
      questions: []
    };

    it('should validate a repeat-sequence config without totalSteps', () => {
      const result = repeatSequenceGameConfigSchema.safeParse(validRepeat);
      expect(result.success).toBe(true);
    });

    it('should reject a repeat-sequence config where maxLength < startLength', () => {
      const bad = {
        ...validRepeat,
        sequence: { ...validRepeat.sequence, startLength: 5, maxLength: 3 }
      };
      const result = repeatSequenceGameConfigSchema.safeParse(bad);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i =>
          i.message.includes('sequence.maxLength must be >= sequence.startLength')
        )).toBe(true);
      }
    });

    it('should reject a repeat-sequence config with duplicate pad ids', () => {
      const dup = {
        ...validRepeat,
        pads: [
          { id: 'dog', idleColor: 9847900, litColor: 14594196, frequency: 293.66 },
          { id: 'dog', idleColor: 13724600, litColor: 16756851, frequency: 369.99 }
        ]
      };
      const result = repeatSequenceGameConfigSchema.safeParse(dup);
      expect(result.success).toBe(false);
    });
  });

  describe('listenTapGameConfigSchema', () => {
    const validListenTap = {
      meta: {
        gameId: 'animal-sounds-01',
        version: '1.0.0',
        totalSteps: 2,
        gameType: 'listen-tap',
        themeName: 'nature',
        pointsPerRound: 10,
        roundDelay: 900,
        supportedLanguages: ['ro', 'en']
      },
      rounds: [
        {
          id: 'r1',
          promptAudioId: 'animal-dog',
          choices: [
            { id: 'c1', imageAssetId: 'dog-tile', correct: true },
            { id: 'c2', imageAssetId: 'cat-tile', correct: false }
          ]
        },
        {
          id: 'r2',
          promptAudioId: 'animal-cat',
          choices: [
            { id: 'c1', imageAssetId: 'cow-tile', correct: false },
            { id: 'c2', imageAssetId: 'cat-tile', correct: true }
          ]
        }
      ],
      questions: []
    };

    it('should validate the bundled animal-sounds listen-tap fixture shape', () => {
      const result = listenTapGameConfigSchema.safeParse(validListenTap);
      expect(result.success).toBe(true);
    });

    it('should accept choices with the optional `letter` overlay used by phonics fixtures', () => {
      const phonics = {
        ...validListenTap,
        meta: { ...validListenTap.meta, gameId: 'phonics-ro-01', themeName: 'default' },
        rounds: [
          {
            id: 'r1',
            promptAudioId: 'letter-a',
            choices: [
              { id: 'c1', imageAssetId: 'letter-a-tile', letter: 'A', correct: true },
              { id: 'c2', imageAssetId: 'letter-m-tile', letter: 'M', correct: false }
            ]
          }
        ]
      };
      const result = listenTapGameConfigSchema.safeParse(phonics);
      expect(result.success).toBe(true);
    });

    it('should accept a transformer-generated config that omits totalSteps', () => {
      // `wordListToGameConfig` in edu-play-core derives content from the
      // teacher's word list; `totalSteps` is optional so the API-served path
      // (no envelope) can validate the same way as the bundled path.
      const noTotalSteps = {
        ...validListenTap,
        meta: { ...validListenTap.meta, totalSteps: undefined }
      };
      delete (noTotalSteps.meta as { totalSteps?: number }).totalSteps;
      const result = listenTapGameConfigSchema.safeParse(noTotalSteps);
      expect(result.success).toBe(true);
    });

    it('should reject a listen-tap config with no rounds', () => {
      const emptyRounds = {
        ...validListenTap,
        rounds: []
      };
      const result = listenTapGameConfigSchema.safeParse(emptyRounds);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: ['rounds'],
              message: 'Listen-tap config must have at least 1 round'
            })
          ])
        );
      }
    });

    it('should reject a round with no correct choice', () => {
      const broken = {
        ...validListenTap,
        rounds: [
          {
            id: 'r1',
            promptAudioId: 'animal-dog',
            choices: [
              { id: 'c1', imageAssetId: 'dog-tile', correct: false },
              { id: 'c2', imageAssetId: 'cat-tile', correct: false }
            ]
          }
        ]
      };
      const result = listenTapGameConfigSchema.safeParse(broken);
      expect(result.success).toBe(false);
    });

    it('should reject a round with multiple correct choices', () => {
      const broken = {
        ...validListenTap,
        rounds: [
          {
            id: 'r1',
            promptAudioId: 'animal-dog',
            choices: [
              { id: 'c1', imageAssetId: 'dog-tile', correct: true },
              { id: 'c2', imageAssetId: 'cat-tile', correct: true }
            ]
          }
        ]
      };
      const result = listenTapGameConfigSchema.safeParse(broken);
      expect(result.success).toBe(false);
    });

    it('should reject a config with duplicate round ids', () => {
      const dup = {
        ...validListenTap,
        rounds: [
          { ...validListenTap.rounds[0], id: 'r1' },
          { ...validListenTap.rounds[1], id: 'r1' }
        ]
      };
      const result = listenTapGameConfigSchema.safeParse(dup);
      expect(result.success).toBe(false);
    });
  });

  describe('parseGameConfig dispatcher', () => {
    const matchingConfig = {
      meta: {
        gameId: 'animals-match-01',
        version: '1.0.0',
        totalSteps: 4,
        gameType: 'matching',
        supportedLanguages: ['en', 'ro']
      },
      pairs: [
        { id: 'p1', imageKey: 'cat', labelKey: 'p1.label' },
        { id: 'p2', imageKey: 'frog', labelKey: 'p2.label' }
      ],
      questions: []
    };

    it('should accept a matching-game config via the dispatcher', () => {
      const result = parseGameConfig(matchingConfig);
      expect(result.success).toBe(true);
    });

    it('should reject a matching config masquerading as multiple-choice', () => {
      const mislabelled = {
        ...matchingConfig,
        meta: { ...matchingConfig.meta, gameType: 'multipleChoice' }
      };
      const result = parseGameConfig(mislabelled);
      expect(result.success).toBe(false);
    });

    it('should default missing gameType to multipleChoice', () => {
      const legacyMultipleChoice = {
        meta: {
          gameId: 'fruits-01',
          version: '1.0.0',
          totalSteps: 1,
          supportedLanguages: ['en']
        },
        questions: [
          {
            id: 'q1',
            questionKey: 'q1.q',
            choices: [
              { type: 'text', value: 'a', isCorrect: true },
              { type: 'text', value: 'b', isCorrect: false }
            ]
          }
        ]
      };
      const result = parseGameConfig(legacyMultipleChoice);
      expect(result.success).toBe(true);
    });

    it('should reject an unknown gameType with a descriptive error', () => {
      const weird = {
        meta: {
          gameId: 'x',
          version: '1.0.0',
          totalSteps: 1,
          gameType: 'unknown-game',
          supportedLanguages: ['en']
        }
      };
      const result = parseGameConfig(weird);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Unknown meta.gameType');
      }
    });
  });

  describe('configLoadOptionsSchema', () => {
    it('should accept an optional configUrl override', () => {
      const result = configLoadOptionsSchema.safeParse({
        gameId: 'fruits-01',
        language: 'en',
        configUrl: '/api/v1/activity-versions/123/config.json'
      });
      expect(result.success).toBe(true);
    });
  });

  describe('gameStringsSchema', () => {
    it('should accept matching-game strings with no questions and a pairs dictionary', () => {
      const strings = {
        meta: { title: 'Animal Names', description: 'Match each animal to its name' },
        questions: {},
        pairs: { 'p1.label': 'Cat', 'p2.label': 'Frog' }
      };
      const result = gameStringsSchema.safeParse(strings);
      expect(result.success).toBe(true);
    });

    it('should accept tracing-game strings with an items dictionary and instruction', () => {
      const strings = {
        instruction: 'Trace the shape!',
        meta: { title: 'Trace Basic Shapes' },
        items: { 'item.circle': 'Circle', 'item.square': 'Square' }
      };
      const result = gameStringsSchema.safeParse(strings);
      expect(result.success).toBe(true);
    });

    it('should accept multiple-choice strings with a questions dictionary', () => {
      const strings = {
        meta: { title: 'Fruit Quiz' },
        questions: { q1: { question: 'Which is an apple?', audio: 'q1' } }
      };
      const result = gameStringsSchema.safeParse(strings);
      expect(result.success).toBe(true);
    });

    it('should reject strings with empty title', () => {
      const invalid = {
        meta: { title: '' },
        questions: { q1: { question: 'Test?' } }
      };
      const result = gameStringsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('gameCatalogSchema', () => {
    it('should accept a multiple-choice catalog using questionCount', () => {
      const catalog = {
        version: '1.0.0',
        games: [
          {
            id: 'fruits-01',
            name: { en: 'Fruit', ro: 'Fructe' },
            languages: ['en', 'ro'],
            difficulty: 'easy',
            questionCount: 3
          }
        ]
      };
      const result = gameCatalogSchema.safeParse(catalog);
      expect(result.success).toBe(true);
    });

    it('should accept a matching catalog using pairCount and gameType', () => {
      const catalog = {
        version: '1.0.0',
        games: [
          {
            id: 'animals-match-01',
            gameType: 'matching',
            name: { en: 'Animals', ro: 'Animale' },
            languages: ['en', 'ro'],
            difficulty: 'easy',
            pairCount: 4
          }
        ]
      };
      const result = gameCatalogSchema.safeParse(catalog);
      expect(result.success).toBe(true);
    });

    it('should accept a tracing catalog using itemCount and gameType', () => {
      const catalog = {
        version: '1.0.0',
        games: [
          {
            id: 'shapes-basic',
            gameType: 'tracing',
            name: { en: 'Shapes', ro: 'Forme' },
            languages: ['en', 'ro'],
            difficulty: 'easy',
            itemCount: 4
          }
        ]
      };
      const result = gameCatalogSchema.safeParse(catalog);
      expect(result.success).toBe(true);
    });

    it('should reject a catalog entry with no count field', () => {
      const catalog = {
        version: '1.0.0',
        games: [
          {
            id: 'unknown-01',
            name: { en: 'x' },
            languages: ['en'],
            difficulty: 'easy'
          }
        ]
      };
      const result = gameCatalogSchema.safeParse(catalog);
      expect(result.success).toBe(false);
    });

    it('should accept a counting catalog using roundCount and gameType', () => {
      const catalog = {
        version: '1.0.0',
        games: [
          {
            id: 'farm-count-01',
            gameType: 'counting',
            name: { en: 'Farm Counting', ro: 'Numărătoare la Fermă' },
            languages: ['ro', 'en'],
            difficulty: 'easy',
            roundCount: 5,
            countRange: [1, 5],
            tags: ['counting', 'farm']
          }
        ]
      };
      const result = gameCatalogSchema.safeParse(catalog);
      expect(result.success).toBe(true);
    });

    it('should accept a repeat-sequence catalog using roundCount', () => {
      const catalog = {
        version: '1.0.0',
        games: [
          {
            id: 'animals-sequence-01',
            gameType: 'repeat-sequence',
            name: { en: 'Animal Sounds', ro: 'Sunetele Animalelor' },
            languages: ['ro', 'en'],
            difficulty: 'medium',
            roundCount: 6
          }
        ]
      };
      const result = gameCatalogSchema.safeParse(catalog);
      expect(result.success).toBe(true);
    });
  });
});
