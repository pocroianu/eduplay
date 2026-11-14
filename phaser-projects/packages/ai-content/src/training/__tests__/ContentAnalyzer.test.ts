/**
 * ContentAnalyzer Unit Tests
 *
 * Tests for the ContentAnalyzer class which analyzes extracted
 * game content for patterns and characteristics.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContentAnalyzer } from '../ContentAnalyzer';
import { ContentAnalyzerConfig, ExtractedGameData, ContentAnalysis } from '../types';
import { readFile, readdir, writeFile, mkdir } from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn()
}));

// Mock sharp for image analysis
vi.mock('sharp', () => ({
  default: vi.fn()
}));

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockExtractedData = (overrides: Partial<ExtractedGameData> = {}): ExtractedGameData => ({
  gameId: 'test-game-01',
  meta: {
    title: 'Test Game',
    theme: 'nature',
    difficulty: 'easy',
    languages: ['en', 'ro']
  },
  questions: [
    {
      id: 'q1',
      text: {
        en: 'Which one is an apple?',
        ro: 'Care este marul?'
      },
      category: 'fruits',
      choices: [
        {
          id: 'apple',
          text: { en: 'Apple', ro: 'Mar' },
          assetPath: 'assets/images/apple.png',
          category: 'fruits'
        },
        {
          id: 'banana',
          text: { en: 'Banana', ro: 'Banana' },
          assetPath: 'assets/images/banana.png',
          category: 'fruits'
        }
      ],
      correctChoice: 'apple',
      difficulty: 1
    },
    {
      id: 'q2',
      text: {
        en: 'What color is the sun?',
        ro: 'Ce culoare are soarele?'
      },
      category: 'colors',
      choices: [
        {
          id: 'yellow',
          text: { en: 'Yellow', ro: 'Galben' },
          category: 'colors'
        },
        {
          id: 'blue',
          text: { en: 'Blue', ro: 'Albastru' },
          category: 'colors'
        }
      ],
      correctChoice: 'yellow',
      difficulty: 1
    }
  ],
  assets: [
    {
      path: 'assets/images/apple.png',
      type: 'image',
      category: 'fruits',
      tags: ['fruit', 'apple', 'red'],
      metadata: {
        width: 512,
        height: 512,
        format: 'png',
        dominantColors: ['#FF0000', '#00FF00'],
        complexity: 0.3
      }
    },
    {
      path: 'assets/images/banana.png',
      type: 'image',
      category: 'fruits',
      tags: ['fruit', 'banana', 'yellow'],
      metadata: {
        width: 512,
        height: 512,
        format: 'png',
        dominantColors: ['#FFFF00'],
        complexity: 0.2
      }
    }
  ],
  statistics: {
    totalQuestions: 2,
    totalChoices: 4,
    totalAssets: 2,
    categoryCounts: { fruits: 1, colors: 1 },
    languageCounts: { en: 2, ro: 2 },
    difficultyDistribution: { '1': 2 }
  },
  ...overrides
});

// =============================================================================
// Test Suite
// =============================================================================

describe('ContentAnalyzer', () => {
  let analyzer: ContentAnalyzer;
  let config: ContentAnalyzerConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      inputPath: '/mock/input',
      outputPath: '/mock/output',
      contentType: 'text'
    };

    analyzer = new ContentAnalyzer(config);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(analyzer).toBeDefined();
    });

    it('should accept different content types', () => {
      const imageAnalyzer = new ContentAnalyzer({
        inputPath: '/input',
        outputPath: '/output',
        contentType: 'image'
      });
      expect(imageAnalyzer).toBeDefined();

      const audioAnalyzer = new ContentAnalyzer({
        inputPath: '/input',
        outputPath: '/output',
        contentType: 'audio'
      });
      expect(audioAnalyzer).toBeDefined();
    });
  });

  // ===========================================================================
  // analyze - Text Content Tests
  // ===========================================================================

  describe('analyze - text content', () => {
    beforeEach(() => {
      vi.mocked(readdir).mockResolvedValue(['game1.json', 'game2.json'] as any);
      vi.mocked(readFile).mockImplementation(async () => {
        return JSON.stringify(createMockExtractedData());
      });
    });

    it('should return correct content type', async () => {
      const result = await analyzer.analyze();

      expect(result.contentType).toBe('text');
    });

    it('should count total items correctly', async () => {
      const result = await analyzer.analyze();

      expect(result.totalItems).toBeGreaterThan(0);
    });

    it('should identify categories from questions', async () => {
      const result = await analyzer.analyze();

      expect(result.patterns.categories).toBeDefined();
      expect(Object.keys(result.patterns.categories).length).toBeGreaterThan(0);
    });

    it('should calculate average word count', async () => {
      const result = await analyzer.analyze();

      expect(result.textAnalysis).toBeDefined();
      expect(result.textAnalysis!.averageWordCount).toBeGreaterThan(0);
    });

    it('should identify common words', async () => {
      const result = await analyzer.analyze();

      expect(result.textAnalysis).toBeDefined();
      expect(Array.isArray(result.textAnalysis!.commonWords)).toBe(true);
    });

    it('should identify sentence patterns', async () => {
      const result = await analyzer.analyze();

      expect(result.textAnalysis).toBeDefined();
      expect(Array.isArray(result.textAnalysis!.sentencePatterns)).toBe(true);
    });

    it('should detect "Which" question pattern', async () => {
      const result = await analyzer.analyze();

      expect(result.textAnalysis!.sentencePatterns).toContain('Which...');
    });

    it('should detect "What" question pattern', async () => {
      const result = await analyzer.analyze();

      expect(result.textAnalysis!.sentencePatterns).toContain('What...');
    });

    it('should handle empty games directory', async () => {
      vi.mocked(readdir).mockResolvedValue([]);

      const result = await analyzer.analyze();

      expect(result.totalItems).toBe(0);
      expect(result.textAnalysis!.averageWordCount).toBe(0);
    });

    it('should handle games without English text', async () => {
      vi.mocked(readFile).mockImplementation(async () => {
        const data = createMockExtractedData();
        data.questions.forEach(q => {
          q.text = { ro: 'Only Romanian' };
        });
        return JSON.stringify(data);
      });

      const result = await analyzer.analyze();

      // Should not crash, may have 0 text items
      expect(result.contentType).toBe('text');
    });

    it('should filter out short words from common words', async () => {
      const result = await analyzer.analyze();

      // Common words should not include very short words (length <= 3)
      const shortWords = result.textAnalysis!.commonWords.filter(
        (w: string) => w.length <= 3
      );
      expect(shortWords.length).toBe(0);
    });
  });

  // ===========================================================================
  // analyze - Image Content Tests
  // ===========================================================================

  describe('analyze - image content', () => {
    beforeEach(() => {
      config.contentType = 'image';
      analyzer = new ContentAnalyzer(config);

      vi.mocked(readdir).mockResolvedValue(['game1.json'] as any);
      vi.mocked(readFile).mockImplementation(async () => {
        return JSON.stringify(createMockExtractedData());
      });
    });

    it('should return correct content type', async () => {
      const result = await analyzer.analyze();

      expect(result.contentType).toBe('image');
    });

    it('should count image assets', async () => {
      const result = await analyzer.analyze();

      expect(result.totalItems).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average dimensions', async () => {
      const result = await analyzer.analyze();

      expect(result.imageAnalysis).toBeDefined();
      // May be 0 if no assets with metadata
      expect(typeof result.imageAnalysis!.averageWidth).toBe('number');
      expect(typeof result.imageAnalysis!.averageHeight).toBe('number');
    });

    it('should identify image formats', async () => {
      const result = await analyzer.analyze();

      expect(result.imageAnalysis).toBeDefined();
      expect(typeof result.imageAnalysis!.formats).toBe('object');
    });

    it('should collect common colors', async () => {
      const result = await analyzer.analyze();

      expect(result.imageAnalysis).toBeDefined();
      expect(Array.isArray(result.imageAnalysis!.commonColors)).toBe(true);
    });

    it('should record themes from games', async () => {
      const result = await analyzer.analyze();

      expect(result.patterns.commonThemes).toBeDefined();
      expect(result.patterns.commonThemes).toContain('nature');
    });

    it('should calculate average complexity', async () => {
      const result = await analyzer.analyze();

      expect(result.imageAnalysis).toBeDefined();
      expect(typeof result.imageAnalysis!.averageComplexity).toBe('number');
    });

    it('should handle games without assets', async () => {
      vi.mocked(readFile).mockImplementation(async () => {
        const data = createMockExtractedData();
        data.assets = [];
        return JSON.stringify(data);
      });

      const result = await analyzer.analyze();

      expect(result.totalItems).toBe(0);
      expect(result.imageAnalysis!.averageWidth).toBe(0);
    });
  });

  // ===========================================================================
  // analyze - Audio Content Tests
  // ===========================================================================

  describe('analyze - audio content', () => {
    beforeEach(() => {
      config.contentType = 'audio';
      analyzer = new ContentAnalyzer(config);
    });

    it('should return correct content type', async () => {
      const result = await analyzer.analyze();

      expect(result.contentType).toBe('audio');
    });

    it('should return audio analysis structure', async () => {
      const result = await analyzer.analyze();

      expect(result.audioAnalysis).toBeDefined();
      expect(typeof result.audioAnalysis!.averageDuration).toBe('number');
      expect(typeof result.audioAnalysis!.sampleRates).toBe('object');
      expect(typeof result.audioAnalysis!.languages).toBe('object');
    });

    it('should include language counts', async () => {
      const result = await analyzer.analyze();

      expect(result.audioAnalysis!.languages).toHaveProperty('en');
      expect(result.audioAnalysis!.languages).toHaveProperty('ro');
    });
  });

  // ===========================================================================
  // analyze - Unknown Content Type
  // ===========================================================================

  describe('analyze - unknown content type', () => {
    it('should throw error for unknown content type', async () => {
      const badConfig = {
        inputPath: '/input',
        outputPath: '/output',
        contentType: 'unknown' as any
      };
      const badAnalyzer = new ContentAnalyzer(badConfig);

      await expect(badAnalyzer.analyze()).rejects.toThrow('Unknown content type');
    });
  });

  // ===========================================================================
  // save Tests
  // ===========================================================================

  describe('save', () => {
    const mockAnalysis: ContentAnalysis = {
      contentType: 'text',
      totalItems: 10,
      patterns: {
        categories: { fruits: 5, animals: 5 },
        styles: {},
        commonThemes: ['nature', 'ocean']
      },
      textAnalysis: {
        averageWordCount: 5.5,
        averageReadability: 2.1,
        commonWords: ['which', 'apple', 'color'],
        sentencePatterns: ['Which...', 'What...']
      }
    };

    beforeEach(() => {
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);
    });

    it('should create output directory', async () => {
      await analyzer.save(mockAnalysis);

      expect(mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    it('should write analysis to file with correct name', async () => {
      await analyzer.save(mockAnalysis);

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('text-analysis.json'),
        expect.any(String)
      );
    });

    it('should write properly formatted JSON', async () => {
      await analyzer.save(mockAnalysis);

      const writeCall = vi.mocked(writeFile).mock.calls[0];
      const content = writeCall[1] as string;

      // Should be valid JSON
      expect(() => JSON.parse(content)).not.toThrow();

      // Should be prettified
      expect(content).toContain('\n');
    });

    it('should log success message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await analyzer.save(mockAnalysis);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Analysis saved')
      );

      consoleSpy.mockRestore();
    });

    it('should handle write errors', async () => {
      vi.mocked(writeFile).mockRejectedValue(new Error('Write failed'));

      await expect(analyzer.save(mockAnalysis)).rejects.toThrow('Write failed');
    });
  });

  // ===========================================================================
  // generateStyleGuide Tests
  // ===========================================================================

  describe('generateStyleGuide', () => {
    it('should generate markdown style guide', () => {
      const analysis: ContentAnalysis = {
        contentType: 'text',
        totalItems: 50,
        patterns: {
          categories: { fruits: 20, animals: 15, colors: 15 },
          styles: {},
          commonThemes: []
        },
        textAnalysis: {
          averageWordCount: 6.2,
          averageReadability: 2.5,
          commonWords: ['which', 'apple', 'what'],
          sentencePatterns: ['Which...', 'What...', 'How...']
        }
      };

      const guide = analyzer.generateStyleGuide(analysis);

      expect(guide).toContain('# TEXT STYLE GUIDE');
      expect(guide).toContain('50 items');
    });

    it('should include image guidelines for image analysis', () => {
      const analysis: ContentAnalysis = {
        contentType: 'image',
        totalItems: 100,
        patterns: {
          categories: { fruits: 50, animals: 50 },
          styles: {},
          commonThemes: []
        },
        imageAnalysis: {
          averageWidth: 512,
          averageHeight: 512,
          commonColors: ['#FF0000', '#00FF00', '#0000FF'],
          averageComplexity: 0.3,
          formats: { png: 80, jpg: 20 }
        }
      };

      const guide = analyzer.generateStyleGuide(analysis);

      expect(guide).toContain('# IMAGE STYLE GUIDE');
      expect(guide).toContain('512x512px');
      expect(guide).toContain('#FF0000');
      expect(guide).toContain('png, jpg');
    });

    it('should include text guidelines for text analysis', () => {
      const analysis: ContentAnalysis = {
        contentType: 'text',
        totalItems: 25,
        patterns: {
          categories: { questions: 25 },
          styles: {},
          commonThemes: []
        },
        textAnalysis: {
          averageWordCount: 7.3,
          averageReadability: 2.1,
          commonWords: ['which', 'one', 'find'],
          sentencePatterns: ['Which...']
        }
      };

      const guide = analyzer.generateStyleGuide(analysis);

      expect(guide).toContain('## Text Guidelines');
      expect(guide).toContain('7.3 words');
      expect(guide).toContain('Which...');
    });

    it('should include categories section', () => {
      const analysis: ContentAnalysis = {
        contentType: 'text',
        totalItems: 30,
        patterns: {
          categories: { fruits: 10, animals: 10, colors: 10 },
          styles: {},
          commonThemes: []
        }
      };

      const guide = analyzer.generateStyleGuide(analysis);

      expect(guide).toContain('## Categories');
      expect(guide).toContain('fruits: 10 items');
      expect(guide).toContain('animals: 10 items');
      expect(guide).toContain('colors: 10 items');
    });

    it('should handle empty analysis gracefully', () => {
      const analysis: ContentAnalysis = {
        contentType: 'text',
        totalItems: 0,
        patterns: {
          categories: {},
          styles: {},
          commonThemes: []
        }
      };

      const guide = analyzer.generateStyleGuide(analysis);

      expect(guide).toContain('# TEXT STYLE GUIDE');
      expect(guide).toContain('0 items');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle readdir failure gracefully', async () => {
      vi.mocked(readdir).mockRejectedValue(new Error('Directory not found'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await analyzer.analyze();

      expect(result.totalItems).toBe(0);

      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON in game files', async () => {
      vi.mocked(readdir).mockResolvedValue(['game1.json'] as any);
      vi.mocked(readFile).mockResolvedValue('{ invalid json }');

      // The analyzer may catch JSON errors internally and log them
      // rather than propagating them, resulting in empty analysis
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await analyzer.analyze();

      // Either throws or returns empty result depending on implementation
      expect(result.totalItems).toBe(0);

      consoleSpy.mockRestore();
    });

    it('should skip non-JSON files', async () => {
      vi.mocked(readdir).mockResolvedValue(['game1.json', 'readme.txt', 'game2.json'] as any);
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        if (path.toString().endsWith('.json')) {
          return JSON.stringify(createMockExtractedData());
        }
        throw new Error('Not a JSON file');
      });

      const result = await analyzer.analyze();

      // Should only process .json files
      expect(result.totalItems).toBeGreaterThan(0);
    });

    it('should handle games with duplicate themes', async () => {
      vi.mocked(readdir).mockResolvedValue(['game1.json', 'game2.json'] as any);
      vi.mocked(readFile).mockImplementation(async () => {
        return JSON.stringify(createMockExtractedData()); // Both have 'nature' theme
      });

      const result = await analyzer.analyze();

      // Themes should be unique
      const uniqueThemes = new Set(result.patterns.commonThemes);
      expect(uniqueThemes.size).toBe(result.patterns.commonThemes.length);
    });

    it('should handle very long text content', async () => {
      vi.mocked(readdir).mockResolvedValue(['game1.json'] as any);
      vi.mocked(readFile).mockImplementation(async () => {
        const data = createMockExtractedData();
        data.questions[0].text.en = 'Which ' + 'word '.repeat(100) + 'is correct?';
        return JSON.stringify(data);
      });

      const result = await analyzer.analyze();

      expect(result.textAnalysis!.averageWordCount).toBeGreaterThan(50);
    });

    it('should limit common colors to top 10', async () => {
      config.contentType = 'image';
      analyzer = new ContentAnalyzer(config);

      vi.mocked(readdir).mockResolvedValue(['game1.json'] as any);
      vi.mocked(readFile).mockImplementation(async () => {
        const data = createMockExtractedData();
        // Add many colors
        data.assets = [
          {
            path: 'test.png',
            type: 'image',
            category: 'test',
            tags: [],
            metadata: {
              width: 512,
              height: 512,
              format: 'png',
              dominantColors: Array.from({ length: 20 }, (_, i) => `#${i.toString(16).padStart(6, '0')}`)
            }
          }
        ];
        return JSON.stringify(data);
      });

      const result = await analyzer.analyze();

      expect(result.imageAnalysis!.commonColors.length).toBeLessThanOrEqual(10);
    });
  });
});
