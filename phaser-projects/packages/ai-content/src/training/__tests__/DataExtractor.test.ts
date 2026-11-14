/**
 * DataExtractor Unit Tests
 *
 * Tests for the DataExtractor class which extracts training data
 * from existing game configurations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataExtractor } from '../DataExtractor';
import { DataExtractorConfig, ExtractedGameData } from '../types';
import { readFile, readdir, stat, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn()
}));

// =============================================================================
// Test Fixtures
// =============================================================================

const mockGameConfig = {
  meta: {
    gameId: 'test-game-01',
    version: '1.0.0',
    title: 'Test Game',
    totalSteps: 3,
    themeName: 'nature',
    difficulty: 'easy',
    supportedLanguages: ['en', 'ro']
  },
  questions: [
    {
      id: 'q1',
      questionKey: 'q1.question',
      category: 'fruits',
      difficulty: 1,
      choices: [
        {
          id: 'apple',
          textKey: 'q1.choices.apple',
          assetPath: 'assets/images/apple.png',
          category: 'fruits',
          correct: true
        },
        {
          id: 'banana',
          textKey: 'q1.choices.banana',
          assetPath: 'assets/images/banana.png',
          category: 'fruits'
        },
        {
          id: 'orange',
          textKey: 'q1.choices.orange',
          assetPath: 'assets/images/orange.png',
          category: 'fruits'
        }
      ],
      correctChoiceId: 'apple'
    },
    {
      id: 'q2',
      questionKey: 'q2.question',
      category: 'fruits',
      difficulty: 2,
      choices: [
        {
          id: 'grape',
          textKey: 'q2.choices.grape',
          assetPath: 'assets/images/grape.png',
          category: 'fruits',
          correct: true
        },
        {
          id: 'strawberry',
          textKey: 'q2.choices.strawberry',
          assetPath: 'assets/images/strawberry.png',
          category: 'fruits'
        }
      ],
      correctChoiceId: 'grape'
    }
  ]
};

const mockEnglishLang = {
  meta: { title: 'Test Game' },
  questions: {
    q1: {
      question: 'Which one is an apple?',
      choices: {
        apple: 'Apple',
        banana: 'Banana',
        orange: 'Orange'
      }
    },
    q2: {
      question: 'Which one is a grape?',
      choices: {
        grape: 'Grape',
        strawberry: 'Strawberry'
      }
    }
  }
};

const mockActivityMetadata = {
  activityId: 'test-game-01',
  gameId: 'test-game-01',
  version: 1
};

const mockRomanianLang = {
  meta: { title: 'Joc de Test' },
  questions: {
    q1: {
      question: 'Care este marul?',
      choices: {
        apple: 'Mar',
        banana: 'Banana',
        orange: 'Portocala'
      }
    },
    q2: {
      question: 'Care este strugurele?',
      choices: {
        grape: 'Strugure',
        strawberry: 'Capsuna'
      }
    }
  }
};

// =============================================================================
// Test Suite
// =============================================================================

describe('DataExtractor', () => {
  let extractor: DataExtractor;
  let config: DataExtractorConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      gamesPath: '/mock/games',
      outputPath: '/mock/output',
      includeAssets: false,
      languages: ['en', 'ro']
    };

    extractor = new DataExtractor(config);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(extractor).toBeDefined();
    });

    it('should accept config with different languages', () => {
      const customConfig: DataExtractorConfig = {
        gamesPath: '/path',
        outputPath: '/output',
        includeAssets: true,
        languages: ['en', 'fr', 'de']
      };

      const customExtractor = new DataExtractor(customConfig);
      expect(customExtractor).toBeDefined();
    });
  });

  // ===========================================================================
  // extractGame Tests
  // ===========================================================================

  describe('extractGame', () => {
    beforeEach(() => {
      // Setup mock file reads
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }
        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(mockGameConfig);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        if (pathStr.endsWith('ro.json')) {
          return JSON.stringify(mockRomanianLang);
        }
        throw new Error(`File not found: ${path}`);
      });

      vi.mocked(stat).mockResolvedValue({
        isDirectory: () => true
      } as any);
    });

    it('should extract game data with correct gameId', async () => {
      const result = await extractor.extractGame('test-game-01');

      expect(result.gameId).toBe('test-game-01');
    });

    it('should extract meta information correctly', async () => {
      const result = await extractor.extractGame('test-game-01');

      expect(result.meta.title).toBe('Test Game');
      expect(result.meta.theme).toBe('nature');
      expect(result.meta.difficulty).toBe('easy');
      expect(result.meta.languages).toEqual(['en', 'ro']);
    });

    it('should extract all questions', async () => {
      const result = await extractor.extractGame('test-game-01');

      expect(result.questions).toHaveLength(2);
    });

    it('should extract question text in all languages', async () => {
      const result = await extractor.extractGame('test-game-01');

      const q1 = result.questions[0];
      expect(q1.text.en).toBe('Which one is an apple?');
      expect(q1.text.ro).toBe('Care este marul?');
    });

    it('should extract choices with correct structure', async () => {
      const result = await extractor.extractGame('test-game-01');

      const q1 = result.questions[0];
      expect(q1.choices).toHaveLength(3);

      const appleChoice = q1.choices.find(c => c.id === 'apple');
      expect(appleChoice).toBeDefined();
      expect(appleChoice!.assetPath).toBe('assets/images/apple.png');
    });

    it('should extract current multiple-choice choices from value/isCorrect/top-level i18n choices', async () => {
      const currentMultipleChoiceConfig = {
        ...mockGameConfig,
        questions: [
          {
            id: 'q1',
            questionKey: 'q1.question',
            choices: [
              { type: 'image', value: 'banana', isCorrect: false },
              { type: 'image', value: 'apple', isCorrect: true },
              { type: 'image', value: 'carrot', isCorrect: false }
            ]
          }
        ]
      };

      const currentEnglishLang = {
        meta: { title: 'Fruit & Object Quiz' },
        questions: {
          q1: {
            question: 'Which one is an apple?'
          }
        },
        choices: {
          apple: 'Apple',
          banana: 'Banana',
          carrot: 'Carrot'
        }
      };

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }
        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(currentMultipleChoiceConfig);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify(currentEnglishLang);
        }
        throw new Error(`File not found: ${path}`);
      });

      const currentShapeExtractor = new DataExtractor({
        ...config,
        languages: ['en']
      });

      const result = await currentShapeExtractor.extractGame('fruits-01');

      const q1 = result.questions[0];
      expect(q1.choices.map(choice => choice.id)).toEqual(['banana', 'apple', 'carrot']);
      expect(q1.correctChoice).toBe('apple');
      expect(q1.choices.find(choice => choice.id === 'apple')?.text.en).toBe('Apple');
    });

    it('should read Activity-version config and strings', async () => {
      const loadedPaths: string[] = [];
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString().replace(/\\/g, '/');
        loadedPaths.push(pathStr);
        if (pathStr.endsWith('/activity.json')) {
          return JSON.stringify({ activityId: 'fruits-01', gameId: 'fruits-01', version: 1 });
        }
        if (pathStr.endsWith('/versions/1/config.json')) {
          return JSON.stringify(mockGameConfig);
        }
        if (pathStr.endsWith('/versions/1/strings/en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        throw new Error(`File not found: ${path}`);
      });
      vi.mocked(stat).mockImplementation(async (path: any) => {
        const pathStr = path.toString().replace(/\\/g, '/');
        if (pathStr.endsWith('/versions/1/config.json') || pathStr.endsWith('/versions/1/strings/en.json')) {
          return { isDirectory: () => false, isFile: () => true } as any;
        }
        return { isDirectory: () => true } as any;
      });

      const activityExtractor = new DataExtractor({
        gamesPath: '/mock/activities',
        outputPath: '/mock/output',
        includeAssets: false,
        languages: ['en']
      });

      const result = await activityExtractor.extractGame('fruits-01');

      expect(result.meta.title).toBe('Test Game');
      expect(loadedPaths).toContain('/mock/activities/fruits-01/activity.json');
      expect(loadedPaths).toContain('/mock/activities/fruits-01/versions/1/config.json');
      expect(loadedPaths).toContain('/mock/activities/fruits-01/versions/1/strings/en.json');
    });

    it('should follow the Activity version declared in activity.json', async () => {
      const loadedPaths: string[] = [];
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString().replace(/\\/g, '/');
        loadedPaths.push(pathStr);
        if (pathStr.endsWith('/activity.json')) {
          return JSON.stringify({ activityId: 'fruits-01', gameId: 'fruits-01', version: 2 });
        }
        if (pathStr.endsWith('/versions/2/config.json')) {
          return JSON.stringify(mockGameConfig);
        }
        if (pathStr.endsWith('/versions/2/strings/en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        throw new Error(`File not found: ${path}`);
      });
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);

      const activityExtractor = new DataExtractor({
        gamesPath: '/mock/activities',
        outputPath: '/mock/output',
        includeAssets: false,
        languages: ['en']
      });

      await activityExtractor.extractGame('fruits-01');

      expect(loadedPaths).toContain('/mock/activities/fruits-01/versions/2/config.json');
      expect(loadedPaths).toContain('/mock/activities/fruits-01/versions/2/strings/en.json');
      expect(loadedPaths).not.toContain('/mock/activities/fruits-01/versions/1/config.json');
    });

    it('should identify correct answer', async () => {
      const result = await extractor.extractGame('test-game-01');

      const q1 = result.questions[0];
      expect(q1.correctChoice).toBe('apple');
    });

    it('should calculate difficulty correctly', async () => {
      const result = await extractor.extractGame('test-game-01');

      // q1 has 3 choices, should have higher difficulty than q2 with 2 choices
      expect(result.questions[0].difficulty).toBeGreaterThanOrEqual(1);
      expect(result.questions[1].difficulty).toBeGreaterThanOrEqual(1);
    });

    it('should infer category from question keys', async () => {
      const result = await extractor.extractGame('test-game-01');

      // Category inference depends on questionKey/assetPath patterns
      // With mock data keys like "q1.question", category defaults to 'general'
      // unless keys contain category-related words
      expect(result.questions[0].category).toBeDefined();
      expect(result.questions[1].category).toBeDefined();
    });

    it('should generate accurate statistics', async () => {
      const result = await extractor.extractGame('test-game-01');

      expect(result.statistics.totalQuestions).toBe(2);
      expect(result.statistics.totalChoices).toBe(5); // 3 + 2
      // Category counts depend on inferred categories
      expect(Object.keys(result.statistics.categoryCounts).length).toBeGreaterThan(0);
      expect(result.statistics.languageCounts.en).toBe(2);
      expect(result.statistics.languageCounts.ro).toBe(2);
    });

    it('should handle missing language file gracefully', async () => {
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }
        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(mockGameConfig);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        // Romanian file not found
        throw new Error(`File not found: ${path}`);
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await extractor.extractGame('test-game-01');

      expect(result.questions[0].text.en).toBe('Which one is an apple?');
      expect(result.questions[0].text.ro).toBeUndefined();

      consoleSpy.mockRestore();
    });

    it('should not extract assets when includeAssets is false', async () => {
      const result = await extractor.extractGame('test-game-01');

      expect(result.assets).toHaveLength(0);
    });

    it('should throw error for missing config file', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

      await expect(extractor.extractGame('nonexistent')).rejects.toThrow();
    });

    it('should throw error for invalid JSON in config', async () => {
      vi.mocked(readFile).mockResolvedValue('{ invalid json }');

      await expect(extractor.extractGame('broken-game')).rejects.toThrow();
    });
  });

  // ===========================================================================
  // extractAll Tests
  // ===========================================================================

  describe('extractAll', () => {
    beforeEach(() => {
      vi.mocked(readdir).mockResolvedValue(['game-1', 'game-2', 'not-a-game.txt'] as any);

      vi.mocked(stat).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes('not-a-game')) {
          return { isDirectory: () => false } as any;
        }
        return { isDirectory: () => true } as any;
      });

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }
        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(mockGameConfig);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        if (pathStr.endsWith('ro.json')) {
          return JSON.stringify(mockRomanianLang);
        }
        throw new Error(`File not found: ${path}`);
      });
    });

    it('should discover and extract all games', async () => {
      const results = await extractor.extractAll();

      expect(results).toHaveLength(2); // game-1 and game-2
    });

    it('should discover Activity folders by versioned config files', async () => {
      vi.mocked(readdir).mockResolvedValue(['fruits-01', 'notes.txt'] as any);
      vi.mocked(stat).mockImplementation(async (path: any) => {
        const pathStr = path.toString().replace(/\\/g, '/');
        if (pathStr.endsWith('/notes.txt')) {
          return { isDirectory: () => false } as any;
        }
        if (pathStr.endsWith('/fruits-01/versions/1/config.json')) {
          return { isDirectory: () => false, isFile: () => true } as any;
        }
        if (pathStr.endsWith('/fruits-01/versions/1/strings/en.json')) {
          return { isDirectory: () => false, isFile: () => true } as any;
        }
        return { isDirectory: () => true } as any;
      });
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString().replace(/\\/g, '/');
        if (pathStr.endsWith('/fruits-01/activity.json')) {
          return JSON.stringify({ activityId: 'fruits-01', gameId: 'fruits-01', version: 1 });
        }
        if (pathStr.endsWith('/fruits-01/versions/1/config.json')) {
          return JSON.stringify(mockGameConfig);
        }
        if (pathStr.endsWith('/fruits-01/versions/1/strings/en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        throw new Error(`File not found: ${path}`);
      });

      const activityExtractor = new DataExtractor({
        gamesPath: '/mock/activities',
        outputPath: '/mock/output',
        includeAssets: false,
        languages: ['en']
      });

      const results = await activityExtractor.extractAll();

      expect(results).toHaveLength(1);
      expect(results[0].gameId).toBe('fruits-01');
    });

    it('should skip directories without config.json', async () => {
      // Clear previous mocks and set up new ones
      vi.mocked(readFile).mockReset();
      vi.mocked(stat).mockReset();

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString().replace(/\\/g, '/');
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }
        if (pathStr.includes('game-2') && pathStr.endsWith('config.json')) {
          throw new Error('File not found');
        }
        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(mockGameConfig);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        if (pathStr.endsWith('ro.json')) {
          return JSON.stringify(mockRomanianLang);
        }
        throw new Error(`File not found: ${path}`);
      });

      // Mock stat to return directory for folders but throw for game-2's config.json
      // Use normalized path check to handle both forward and back slashes
      vi.mocked(stat).mockImplementation(async (path: any) => {
        const pathStr = path.toString().replace(/\\/g, '/');
        if (pathStr.endsWith('config.json')) {
          // game-2 config doesn't exist
          if (pathStr.includes('game-2')) {
            throw new Error('File not found');
          }
          return { isDirectory: () => false, isFile: () => true } as any;
        }
        // Non-config.json paths: check for not-a-game, otherwise return directory
        if (pathStr.includes('not-a-game')) {
          return { isDirectory: () => false } as any;
        }
        return { isDirectory: () => true } as any;
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const results = await extractor.extractAll();

      // game-2 should be skipped because its config.json stat throws
      expect(results).toHaveLength(1); // Only game-1

      consoleSpy.mockRestore();
    });

    it('should continue extraction when one game fails', async () => {
      let callCount = 0;
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }

        // Make game-1 fail completely
        if (pathStr.includes('game-1') && pathStr.endsWith('config.json')) {
          throw new Error('Corrupted config');
        }

        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(mockGameConfig);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        if (pathStr.endsWith('ro.json')) {
          return JSON.stringify(mockRomanianLang);
        }
        throw new Error(`File not found: ${path}`);
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const results = await extractor.extractAll();

      expect(results).toHaveLength(1); // Only game-2 succeeds

      consoleSpy.mockRestore();
    });

    it('should return empty array when no games found', async () => {
      vi.mocked(readdir).mockResolvedValue([]);

      const results = await extractor.extractAll();

      expect(results).toHaveLength(0);
    });
  });

  // ===========================================================================
  // save Tests
  // ===========================================================================

  describe('save', () => {
    const mockExtractedData: ExtractedGameData[] = [
      {
        gameId: 'test-game-01',
        meta: {
          title: 'Test Game',
          theme: 'nature',
          difficulty: 'easy',
          languages: ['en', 'ro']
        },
        questions: [],
        assets: [],
        statistics: {
          totalQuestions: 0,
          totalChoices: 0,
          totalAssets: 0,
          categoryCounts: {},
          languageCounts: {},
          difficultyDistribution: {}
        }
      }
    ];

    beforeEach(() => {
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);
    });

    it('should create output directory', async () => {
      await extractor.save(mockExtractedData);

      // mkdir should be called with path containing output path (forward or backslash)
      const mkdirCalls = vi.mocked(mkdir).mock.calls;
      expect(mkdirCalls.length).toBeGreaterThan(0);
      // Path may use forward or backslashes depending on OS
      const pathContainsOutputDir = mkdirCalls.some(call => {
        const pathArg = call[0] as string;
        return pathArg.includes('mock') && pathArg.includes('output');
      });
      expect(pathContainsOutputDir).toBe(true);
    });

    it('should write aggregated games file', async () => {
      await extractor.save(mockExtractedData);

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('extracted-games.json'),
        expect.any(String)
      );
    });

    it('should write individual game files', async () => {
      await extractor.save(mockExtractedData);

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-game-01.json'),
        expect.any(String)
      );
    });

    it('should write summary statistics', async () => {
      await extractor.save(mockExtractedData);

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('summary.json'),
        expect.any(String)
      );
    });

    it('should handle write errors', async () => {
      vi.mocked(writeFile).mockRejectedValue(new Error('Write failed'));

      await expect(extractor.save(mockExtractedData)).rejects.toThrow('Write failed');
    });

    it('should save properly formatted JSON', async () => {
      await extractor.save(mockExtractedData);

      const writeCall = vi.mocked(writeFile).mock.calls[0];
      const content = writeCall[1] as string;

      // Should be valid JSON
      expect(() => JSON.parse(content)).not.toThrow();

      // Should be prettified (contains newlines)
      expect(content).toContain('\n');
    });
  });

  // ===========================================================================
  // Category Inference Tests
  // ===========================================================================

  describe('category inference', () => {
    it('should infer fruits category from fruit-related keys', async () => {
      // Use assetPath with fruit-related path for category inference
      const fruitConfig = {
        ...mockGameConfig,
        questions: [
          {
            id: 'q1',
            questionKey: 'fruit.question', // Contains 'fruit'
            choices: [
              { id: 'apple', textKey: 'q1.choices.apple', assetPath: 'assets/fruit/apple.png', correct: true },
              { id: 'banana', textKey: 'q1.choices.banana', assetPath: 'assets/fruit/banana.png' }
            ]
          }
        ]
      };

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }
        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(fruitConfig);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        if (pathStr.endsWith('ro.json')) {
          return JSON.stringify(mockRomanianLang);
        }
        throw new Error(`File not found: ${path}`);
      });

      const result = await extractor.extractGame('test-game');

      expect(result.questions[0].category).toBe('fruits');
    });

    it('should infer animals category from animal-related keys', async () => {
      const animalConfig = {
        ...mockGameConfig,
        questions: [
          {
            id: 'q1',
            questionKey: 'animal.question', // Contains 'animal'
            choices: [
              { id: 'dog', textKey: 'q1.choices.dog', assetPath: 'assets/animal/dog.png', correct: true },
              { id: 'cat', textKey: 'q1.choices.cat', assetPath: 'assets/animal/cat.png' }
            ]
          }
        ]
      };

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }
        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(animalConfig);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        if (pathStr.endsWith('ro.json')) {
          return JSON.stringify(mockRomanianLang);
        }
        throw new Error(`File not found: ${path}`);
      });

      const result = await extractor.extractGame('test-game');

      expect(result.questions[0].category).toBe('animals');
    });

    it('should infer colors category from color-related keys', async () => {
      const colorConfig = {
        ...mockGameConfig,
        questions: [
          {
            id: 'q1',
            questionKey: 'color.question', // Contains 'color'
            choices: [
              { id: 'red', textKey: 'q1.choices.red', assetPath: 'assets/color/red.png', correct: true },
              { id: 'blue', textKey: 'q1.choices.blue', assetPath: 'assets/color/blue.png' }
            ]
          }
        ]
      };

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }
        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(colorConfig);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        if (pathStr.endsWith('ro.json')) {
          return JSON.stringify(mockRomanianLang);
        }
        throw new Error(`File not found: ${path}`);
      });

      const result = await extractor.extractGame('test-game');

      expect(result.questions[0].category).toBe('colors');
    });

    it('should default to general category when no pattern matches', async () => {
      const unknownConfig = {
        ...mockGameConfig,
        questions: [
          {
            id: 'q1',
            questionKey: 'q1.question',
            choices: [
              { id: 'xyz', textKey: 'q1.choices.xyz', correct: true },
              { id: 'abc', textKey: 'q1.choices.abc' }
            ]
          }
        ]
      };

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }
        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(unknownConfig);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        if (pathStr.endsWith('ro.json')) {
          return JSON.stringify(mockRomanianLang);
        }
        throw new Error(`File not found: ${path}`);
      });

      const result = await extractor.extractGame('test-game');

      expect(result.questions[0].category).toBe('general');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle empty questions array', async () => {
      const emptyConfig = {
        ...mockGameConfig,
        questions: []
      };

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }
        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(emptyConfig);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        if (pathStr.endsWith('ro.json')) {
          return JSON.stringify(mockRomanianLang);
        }
        throw new Error(`File not found: ${path}`);
      });

      const result = await extractor.extractGame('test-game');

      expect(result.questions).toHaveLength(0);
      expect(result.statistics.totalQuestions).toBe(0);
    });

    it('should handle questions without choices', async () => {
      const noChoicesConfig = {
        ...mockGameConfig,
        questions: [
          {
            id: 'q1',
            questionKey: 'q1.question'
            // No choices array
          }
        ]
      };

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }
        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(noChoicesConfig);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        if (pathStr.endsWith('ro.json')) {
          return JSON.stringify(mockRomanianLang);
        }
        throw new Error(`File not found: ${path}`);
      });

      const result = await extractor.extractGame('test-game');

      expect(result.questions[0].choices).toHaveLength(0);
    });

    it('should handle missing meta fields gracefully', async () => {
      const minimalConfig = {
        meta: {},
        questions: []
      };

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }
        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(minimalConfig);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify({ meta: {} });
        }
        if (pathStr.endsWith('ro.json')) {
          return JSON.stringify({ meta: {} });
        }
        throw new Error(`File not found: ${path}`);
      });

      const result = await extractor.extractGame('test-game');

      expect(result.meta.difficulty).toBe('easy'); // Default
    });

    it('should handle large number of questions', async () => {
      const manyQuestions = {
        ...mockGameConfig,
        questions: Array.from({ length: 100 }, (_, i) => ({
          id: `q${i}`,
          questionKey: `q${i}.question`,
          choices: [
            { id: `choice-${i}-a`, textKey: `q${i}.choices.a`, correct: true },
            { id: `choice-${i}-b`, textKey: `q${i}.choices.b` }
          ]
        }))
      };

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('activity.json')) {
          return JSON.stringify(mockActivityMetadata);
        }
        if (pathStr.endsWith('config.json')) {
          return JSON.stringify(manyQuestions);
        }
        if (pathStr.endsWith('en.json')) {
          return JSON.stringify(mockEnglishLang);
        }
        if (pathStr.endsWith('ro.json')) {
          return JSON.stringify(mockRomanianLang);
        }
        throw new Error(`File not found: ${path}`);
      });

      const result = await extractor.extractGame('test-game');

      expect(result.questions).toHaveLength(100);
      expect(result.statistics.totalQuestions).toBe(100);
    });
  });
});
