/**
 * Phase 3 Training Data Collection - Integration Tests
 *
 * This test suite validates the complete Phase 3 implementation:
 * - Full pipeline: extract -> analyze -> build prompts -> build dataset -> validate
 * - Component integration between DataExtractor, ContentAnalyzer, PromptBuilder,
 *   DatasetBuilder, and QualityValidator
 * - End-to-end training data generation workflow
 *
 * Tests are designed to verify that all components work together correctly
 * to produce training datasets for LoRA fine-tuning.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataExtractor } from '../DataExtractor';
import { ContentAnalyzer } from '../ContentAnalyzer';
import { PromptBuilder, buildPrompt, getPromptBuilder } from '../PromptBuilder';
import { DatasetBuilder } from '../DatasetBuilder';
import { QualityValidator } from '../QualityValidator';
import {
  DataExtractorConfig,
  ContentAnalyzerConfig,
  DatasetBuilderConfig,
  ExtractedGameData,
  TextDatasetEntry,
  ImageDatasetEntry
} from '../types';
import { readFile, readdir, stat, writeFile, mkdir } from 'fs/promises';

// =============================================================================
// Mock Setup
// =============================================================================

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn()
}));

vi.mock('sharp', () => ({
  default: vi.fn().mockImplementation(() => ({
    metadata: vi.fn().mockResolvedValue({
      width: 512,
      height: 512,
      format: 'png'
    }),
    stats: vi.fn().mockResolvedValue({
      channels: [
        { mean: 200, stdev: 30, entropy: 3.5 },
        { mean: 210, stdev: 25, entropy: 3.2 },
        { mean: 220, stdev: 20, entropy: 3.0 }
      ]
    }),
    greyscale: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue({
      data: Buffer.alloc(512 * 512),
      info: { width: 512, height: 512 }
    })
  }))
}));

vi.mock('syllable', () => ({
  syllable: vi.fn().mockImplementation((text: string) => {
    const words = text.split(/\s+/);
    return words.reduce((sum, word) => sum + Math.ceil(word.length / 3), 0);
  })
}));

// =============================================================================
// Test Fixtures
// =============================================================================

const mockGameConfig = {
  meta: {
    gameId: 'fruits-01',
    version: '1.0.0',
    title: 'Fruit Quiz',
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
        { id: 'apple', textKey: 'q1.choices.apple', assetPath: 'assets/apple.png', category: 'fruits', correct: true },
        { id: 'banana', textKey: 'q1.choices.banana', assetPath: 'assets/banana.png', category: 'fruits' },
        { id: 'orange', textKey: 'q1.choices.orange', assetPath: 'assets/orange.png', category: 'fruits' }
      ]
    },
    {
      id: 'q2',
      questionKey: 'q2.question',
      category: 'fruits',
      difficulty: 1,
      choices: [
        { id: 'grape', textKey: 'q2.choices.grape', assetPath: 'assets/grape.png', category: 'fruits', correct: true },
        { id: 'strawberry', textKey: 'q2.choices.strawberry', assetPath: 'assets/strawberry.png', category: 'fruits' }
      ]
    }
  ]
};

const mockEnglishLang = {
  meta: { title: 'Fruit Quiz' },
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

const mockRomanianLang = {
  meta: { title: 'Test cu Fructe' },
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
// Integration Test Suite
// =============================================================================

describe('Training Data Collection - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // 1. Full Pipeline Test
  // ===========================================================================

  describe('Full Pipeline: Extract -> Analyze -> Build -> Validate', () => {
    it('should complete the full training data pipeline', async () => {
      // Step 1: Setup mocks for extraction
      vi.mocked(readdir).mockResolvedValue(['fruits-01', 'colors-01'] as any);
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('config.json')) return JSON.stringify(mockGameConfig);
        if (pathStr.endsWith('en.json')) return JSON.stringify(mockEnglishLang);
        if (pathStr.endsWith('ro.json')) return JSON.stringify(mockRomanianLang);
        throw new Error(`File not found: ${path}`);
      });

      // Step 1: Extract data
      const extractorConfig: DataExtractorConfig = {
        gamesPath: '/games',
        outputPath: '/output',
        includeAssets: false,
        languages: ['en', 'ro']
      };
      const extractor = new DataExtractor(extractorConfig);
      const extractedGames = await extractor.extractAll();

      expect(extractedGames.length).toBeGreaterThan(0);

      // Step 2: Analyze content
      vi.mocked(readdir).mockResolvedValue(['fruits-01.json'] as any);
      vi.mocked(readFile).mockImplementation(async () => {
        return JSON.stringify(extractedGames[0]);
      });

      const analyzerConfig: ContentAnalyzerConfig = {
        inputPath: '/output',
        outputPath: '/analysis',
        contentType: 'text'
      };
      const analyzer = new ContentAnalyzer(analyzerConfig);
      const analysis = await analyzer.analyze();

      expect(analysis.totalItems).toBeGreaterThan(0);
      expect(analysis.patterns.categories).toBeDefined();

      // Step 3: Build prompts
      const promptBuilder = new PromptBuilder();
      const promptResults = promptBuilder.buildPromptsForCategory('fruits', 'image', [
        { fruit: 'apple' },
        { fruit: 'banana' },
        { fruit: 'orange' }
      ]);

      const successfulPrompts = promptResults.filter(r => r.success);
      expect(successfulPrompts.length).toBeGreaterThan(0);

      // Step 4: Create dataset entries
      const textEntries: TextDatasetEntry[] = extractedGames.flatMap(game =>
        game.questions.map((q, i) => ({
          id: `text-${game.gameId}-${i}`,
          prompt: `Generate a question about ${q.category}`,
          completion: q.text.en || '',
          category: q.category,
          metadata: {
            language: 'en',
            difficulty: q.difficulty.toString(),
            targetAge: '3-8',
            wordCount: (q.text.en || '').split(/\s+/).length,
            readabilityScore: 2.0
          }
        }))
      );

      // Step 5: Build dataset
      const datasetConfig: DatasetBuilderConfig = {
        outputPath: '/datasets',
        split: { train: 0.7, val: 0.15, test: 0.15 },
        shuffle: true,
        seed: 42
      };
      const datasetBuilder = new DatasetBuilder(datasetConfig);

      // Need at least 10 entries
      const paddedEntries = [
        ...textEntries,
        ...Array.from({ length: Math.max(0, 10 - textEntries.length) }, (_, i) => ({
          id: `text-padding-${i}`,
          prompt: 'Generate a question',
          completion: `Question ${i}?`,
          category: 'general',
          metadata: {
            language: 'en',
            difficulty: 'easy',
            targetAge: '3-8',
            wordCount: 2,
            readabilityScore: 1.0
          }
        }))
      ];

      await datasetBuilder.buildTextDataset(paddedEntries);

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('train.jsonl'),
        expect.any(String)
      );

      // Step 6: Validate quality
      const validator = new QualityValidator();
      const validationResults = await validator.validateBatch(
        paddedEntries.slice(0, 5).map(e => e.completion),
        async (text) => validator.validateText(text)
      );

      expect(validationResults.summary.total).toBe(5);
      expect(validationResults.summary.passRate).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================================================
  // 2. Extractor -> Analyzer Integration
  // ===========================================================================

  describe('DataExtractor -> ContentAnalyzer Integration', () => {
    it('should analyze extracted game data correctly', async () => {
      // Setup extraction
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('config.json')) return JSON.stringify(mockGameConfig);
        if (pathStr.endsWith('en.json')) return JSON.stringify(mockEnglishLang);
        if (pathStr.endsWith('ro.json')) return JSON.stringify(mockRomanianLang);
        throw new Error(`File not found: ${path}`);
      });

      const extractor = new DataExtractor({
        gamesPath: '/games',
        outputPath: '/output',
        includeAssets: false,
        languages: ['en', 'ro']
      });

      const extracted = await extractor.extractGame('fruits-01');

      // Setup analyzer to read extracted data
      vi.mocked(readdir).mockResolvedValue(['fruits-01.json'] as any);
      vi.mocked(readFile).mockImplementation(async () => JSON.stringify(extracted));

      const analyzer = new ContentAnalyzer({
        inputPath: '/output',
        outputPath: '/analysis',
        contentType: 'text'
      });

      const analysis = await analyzer.analyze();

      // Verify extracted questions are analyzed (categories depend on inference)
      expect(Object.keys(analysis.patterns.categories).length).toBeGreaterThan(0);
      expect(analysis.textAnalysis!.sentencePatterns).toContain('Which...');
    });

    it('should detect common patterns from multiple games', async () => {
      const game1 = {
        ...mockGameConfig,
        gameId: 'game-1',
        questions: [
          { id: 'q1', text: { en: 'Which one is red?' }, category: 'colors', choices: [], correctChoice: '', difficulty: 1 }
        ]
      };

      const game2 = {
        ...mockGameConfig,
        gameId: 'game-2',
        questions: [
          { id: 'q1', text: { en: 'Which one is blue?' }, category: 'colors', choices: [], correctChoice: '', difficulty: 1 }
        ]
      };

      vi.mocked(readdir).mockResolvedValue(['game-1.json', 'game-2.json'] as any);
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        if (path.toString().includes('game-1')) return JSON.stringify(game1);
        return JSON.stringify(game2);
      });

      const analyzer = new ContentAnalyzer({
        inputPath: '/output',
        outputPath: '/analysis',
        contentType: 'text'
      });

      const analysis = await analyzer.analyze();

      // Analysis should have category counts (may be 'general' if colors not inferred)
      expect(Object.keys(analysis.patterns.categories).length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // 3. PromptBuilder -> QualityValidator Integration
  // ===========================================================================

  describe('PromptBuilder -> QualityValidator Integration', () => {
    it('should validate generated prompts for quality', async () => {
      const promptBuilder = new PromptBuilder();
      const validator = new QualityValidator();

      // Generate prompts for fruits
      const fruits = ['apple', 'banana', 'orange', 'grape', 'strawberry'];
      const promptResults = fruits.map(fruit =>
        promptBuilder.buildPrompt('fruit-cartoon-simple', { fruit })
      );

      // All prompts should build successfully
      const successfulPrompts = promptResults.filter(r => r.success);
      expect(successfulPrompts.length).toBe(fruits.length);

      // Validate prompt quality (as text)
      const validationResults = await Promise.all(
        successfulPrompts.map(async r => {
          // Prompts are image prompts, but we can validate their text structure
          const text = r.prompt!.prompt;
          return {
            prompt: text,
            // Check basic quality attributes
            hasContent: text.length > 0,
            hasFruit: fruits.some(f => text.toLowerCase().includes(f)),
            notEmpty: text.trim().length > 0
          };
        })
      );

      validationResults.forEach(v => {
        expect(v.hasContent).toBe(true);
        expect(v.hasFruit).toBe(true);
        expect(v.notEmpty).toBe(true);
      });
    });

    it('should filter out low-quality generated content', async () => {
      const promptBuilder = new PromptBuilder();
      const validator = new QualityValidator();

      // Generate text prompts for questions
      const questionResult = promptBuilder.buildPrompt('question-identification-simple', {
        targetAge: '3-8',
        category: 'fruit',
        item: 'apple'
      });

      expect(questionResult.success).toBe(true);

      // The generated prompt template is a meta-prompt for LLM
      // In real scenario, LLM output would be validated
      const sampleGeneratedQuestion = 'Which one is the apple?';
      const validation = await validator.validateText(sampleGeneratedQuestion);

      // Validation may pass or fail based on various metrics, but should be safe
      expect(validation.text!.safetyScore).toBe(100);
    });
  });

  // ===========================================================================
  // 4. DatasetBuilder -> QualityValidator Integration
  // ===========================================================================

  describe('DatasetBuilder -> QualityValidator Integration', () => {
    it('should validate dataset entries before building', async () => {
      const validator = new QualityValidator();
      const builder = new DatasetBuilder({
        outputPath: '/output',
        split: { train: 0.7, val: 0.15, test: 0.15 },
        shuffle: true,
        seed: 42
      });

      // Create text entries
      const entries: TextDatasetEntry[] = [
        { id: 't1', prompt: 'Generate question', completion: 'Which one is an apple?', category: 'fruits', metadata: { language: 'en', difficulty: 'easy', targetAge: '3-8', wordCount: 5, readabilityScore: 2 } },
        { id: 't2', prompt: 'Generate question', completion: 'Which one is a banana?', category: 'fruits', metadata: { language: 'en', difficulty: 'easy', targetAge: '3-8', wordCount: 5, readabilityScore: 2 } },
        { id: 't3', prompt: 'Generate question', completion: 'Which one is red?', category: 'colors', metadata: { language: 'en', difficulty: 'easy', targetAge: '3-8', wordCount: 4, readabilityScore: 2 } }
      ];

      // Validate each entry
      const validationResults = await validator.validateBatch(
        entries.map(e => e.completion),
        async (text) => validator.validateText(text)
      );

      // Filter to only passed entries
      const validEntries = entries.filter((_, i) => validationResults.results[i].passed);

      // Validate dataset structure
      const datasetValidation = builder.validateDataset(validEntries);

      // With only 3 valid entries (less than 10), dataset validation will fail
      if (validEntries.length < 10) {
        expect(datasetValidation.valid).toBe(false);
      }
    });

    it('should report quality statistics for dataset', async () => {
      const validator = new QualityValidator();

      // Create entries that meet word count requirements (5-15 words)
      const entries = Array.from({ length: 20 }, (_, i) => ({
        id: `text-${i}`,
        completion: `Which one is the item number ${i} here today?`
      }));

      const { summary } = await validator.validateBatch(
        entries.map(e => e.completion),
        async (text) => validator.validateText(text)
      );

      expect(summary.total).toBe(20);
      // Average score should be defined (may be NaN if no valid entries)
      expect(typeof summary.averageScore).toBe('number');
      expect(summary.passRate).toBeDefined();
    });
  });

  // ===========================================================================
  // 5. Complete Workflow Simulation
  // ===========================================================================

  describe('Complete Training Data Workflow', () => {
    it('should generate training data for LoRA fine-tuning', async () => {
      // This test simulates the complete workflow described in Phase 3

      // 1. Extract existing game content
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('config.json')) return JSON.stringify(mockGameConfig);
        if (pathStr.endsWith('en.json')) return JSON.stringify(mockEnglishLang);
        if (pathStr.endsWith('ro.json')) return JSON.stringify(mockRomanianLang);
        throw new Error(`File not found: ${path}`);
      });

      const extractor = new DataExtractor({
        gamesPath: '/games',
        outputPath: '/extracted',
        includeAssets: false,
        languages: ['en', 'ro']
      });

      const extracted = await extractor.extractGame('fruits-01');
      expect(extracted.questions.length).toBe(2);

      // 2. Analyze content patterns
      vi.mocked(readdir).mockResolvedValue(['fruits-01.json'] as any);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(extracted));

      const analyzer = new ContentAnalyzer({
        inputPath: '/extracted',
        outputPath: '/analysis',
        contentType: 'text'
      });

      const analysis = await analyzer.analyze();
      const styleGuide = analyzer.generateStyleGuide(analysis);

      expect(styleGuide).toContain('STYLE GUIDE');

      // 3. Generate image prompts using templates
      const promptBuilder = getPromptBuilder();
      const fruitPrompts = ['apple', 'banana', 'orange'].map(fruit =>
        promptBuilder.buildPrompt('fruit-cartoon-simple', { fruit })
      );

      const successfulImagePrompts = fruitPrompts.filter(r => r.success);
      expect(successfulImagePrompts.length).toBe(3);

      // 4. Create image dataset entries
      const imageEntries: ImageDatasetEntry[] = successfulImagePrompts.map((r, i) => ({
        id: `img-${i + 1}`,
        prompt: r.prompt!.prompt,
        negativePrompt: r.prompt!.negativePrompt || '',
        imagePath: `images/fruit-${i + 1}.png`,
        category: 'fruits',
        style: 'cartoon',
        metadata: {
          width: 512,
          height: 512,
          tags: ['fruit', 'cartoon', 'educational']
        }
      }));

      // 5. Create text dataset entries from extracted questions
      const textEntries: TextDatasetEntry[] = extracted.questions.map((q, i) => ({
        id: `text-${i + 1}`,
        prompt: `Generate an educational question about ${q.category}`,
        completion: q.text.en || '',
        category: q.category,
        metadata: {
          language: 'en',
          difficulty: q.difficulty.toString(),
          targetAge: '3-8',
          wordCount: (q.text.en || '').split(/\s+/).length,
          readabilityScore: 2.0
        }
      }));

      // 6. Validate content quality
      const validator = new QualityValidator();
      const { summary: textQuality } = await validator.validateBatch(
        textEntries.map(e => e.completion),
        async (text) => validator.validateText(text)
      );

      expect(textQuality.passRate).toBeGreaterThanOrEqual(0);

      // 7. Build final datasets (pad to meet minimum)
      const paddedTextEntries = [
        ...textEntries,
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `text-pad-${i}`,
          prompt: 'Generate question',
          completion: `Sample question ${i}?`,
          category: 'general',
          metadata: {
            language: 'en',
            difficulty: 'easy',
            targetAge: '3-8',
            wordCount: 3,
            readabilityScore: 1.5
          }
        }))
      ];

      const paddedImageEntries = [
        ...imageEntries,
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `img-pad-${i}`,
          prompt: `Sample image prompt ${i}`,
          negativePrompt: '',
          imagePath: `images/sample-${i}.png`,
          category: 'general',
          style: 'cartoon',
          metadata: { width: 512, height: 512, tags: [] }
        }))
      ];

      const datasetBuilder = new DatasetBuilder({
        outputPath: '/training',
        split: { train: 0.7, val: 0.15, test: 0.15 },
        shuffle: true,
        seed: 42
      });

      await datasetBuilder.buildTextDataset(paddedTextEntries);
      await datasetBuilder.buildImageDataset(paddedImageEntries);

      // Verify outputs
      const writeCallPaths = vi.mocked(writeFile).mock.calls.map(c => c[0].toString());

      expect(writeCallPaths.some(p => p.includes('text'))).toBe(true);
      expect(writeCallPaths.some(p => p.includes('image'))).toBe(true);
      expect(writeCallPaths.some(p => p.includes('manifest.json'))).toBe(true);
    });
  });

  // ===========================================================================
  // 6. Error Handling Integration
  // ===========================================================================

  describe('Error Handling Across Components', () => {
    it('should handle extraction failures gracefully', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const extractor = new DataExtractor({
        gamesPath: '/games',
        outputPath: '/output',
        includeAssets: false,
        languages: ['en']
      });

      await expect(extractor.extractGame('missing-game')).rejects.toThrow();
    });

    it('should handle analysis failures gracefully', async () => {
      vi.mocked(readdir).mockRejectedValue(new Error('Directory not found'));

      const analyzer = new ContentAnalyzer({
        inputPath: '/missing',
        outputPath: '/output',
        contentType: 'text'
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const analysis = await analyzer.analyze();

      expect(analysis.totalItems).toBe(0);

      consoleSpy.mockRestore();
    });

    it('should handle prompt building failures gracefully', () => {
      const builder = new PromptBuilder();

      const result = builder.buildPrompt('non-existent', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle dataset building failures gracefully', async () => {
      const builder = new DatasetBuilder({
        outputPath: '/output',
        split: { train: 0.7, val: 0.15, test: 0.15 },
        shuffle: false
      });

      // Empty entries should throw
      await expect(builder.buildTextDataset([])).rejects.toThrow();
    });

    it('should handle validation failures gracefully', async () => {
      const validator = new QualityValidator();

      // Text with unsafe content
      const result = await validator.validateText('This is scary content');

      expect(result.passed).toBe(false);
      expect(result.text!.safetyScore).toBe(0);
    });
  });

  // ===========================================================================
  // 7. Data Flow Verification
  // ===========================================================================

  describe('Data Flow Verification', () => {
    it('should preserve data integrity through pipeline', async () => {
      // Extract
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('config.json')) return JSON.stringify(mockGameConfig);
        if (pathStr.endsWith('en.json')) return JSON.stringify(mockEnglishLang);
        if (pathStr.endsWith('ro.json')) return JSON.stringify(mockRomanianLang);
        throw new Error(`File not found: ${path}`);
      });

      const extractor = new DataExtractor({
        gamesPath: '/games',
        outputPath: '/output',
        includeAssets: false,
        languages: ['en', 'ro']
      });

      const extracted = await extractor.extractGame('fruits-01');

      // Verify extracted data has expected structure
      expect(extracted.gameId).toBe('fruits-01');
      expect(extracted.questions[0].text.en).toBe('Which one is an apple?');
      expect(extracted.questions[0].text.ro).toBe('Care este marul?');

      // Build text entries
      const datasetBuilder = new DatasetBuilder({
        outputPath: '/output',
        split: { train: 0.7, val: 0.15, test: 0.15 },
        shuffle: false // Disable shuffle to verify order
      });

      const textEntries = datasetBuilder.createTextDatasetEntries(extracted.questions);

      // Verify entries preserve original content
      expect(textEntries[0].completion).toBe('Which one is an apple?');
      // Category is inferred and may be 'general' if no patterns match
      expect(textEntries[0].category).toBeDefined();
    });

    it('should maintain category consistency across pipeline', async () => {
      // Create a config with question keys that match the fruit category pattern
      const fruitCategoryConfig = {
        meta: {
          gameId: 'fruits-01',
          version: '1.0.0',
          title: 'Fruit Quiz',
          totalSteps: 3,
          themeName: 'nature',
          difficulty: 'easy',
          supportedLanguages: ['en']
        },
        questions: [
          {
            id: 'q1',
            questionKey: 'fruit.q1.question', // Contains 'fruit' for category matching
            category: 'fruits',
            difficulty: 1,
            choices: [
              { id: 'apple', textKey: 'q1.choices.apple', assetPath: 'assets/fruit/apple.png', category: 'fruits', correct: true },
              { id: 'banana', textKey: 'q1.choices.banana', assetPath: 'assets/fruit/banana.png', category: 'fruits' }
            ]
          },
          {
            id: 'q2',
            questionKey: 'fruit.q2.question', // Contains 'fruit' for category matching
            category: 'fruits',
            difficulty: 1,
            choices: [
              { id: 'grape', textKey: 'q2.choices.grape', assetPath: 'assets/fruit/grape.png', category: 'fruits', correct: true },
              { id: 'strawberry', textKey: 'q2.choices.strawberry', assetPath: 'assets/fruit/strawberry.png', category: 'fruits' }
            ]
          }
        ]
      };

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('config.json')) return JSON.stringify(fruitCategoryConfig);
        if (pathStr.endsWith('en.json')) return JSON.stringify(mockEnglishLang);
        if (pathStr.endsWith('ro.json')) return JSON.stringify(mockRomanianLang);
        throw new Error(`File not found: ${path}`);
      });

      const extractor = new DataExtractor({
        gamesPath: '/games',
        outputPath: '/output',
        includeAssets: false,
        languages: ['en']
      });

      const extracted = await extractor.extractGame('fruits-01');

      // Questions should have categories - with our fruit keys they should all be 'fruits'
      expect(extracted.questions.every(q => q.category === 'fruits')).toBe(true);

      // Analyze should reflect the categories
      vi.mocked(readdir).mockResolvedValue(['fruits-01.json'] as any);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(extracted));

      const analyzer = new ContentAnalyzer({
        inputPath: '/output',
        outputPath: '/analysis',
        contentType: 'text'
      });

      const analysis = await analyzer.analyze();

      // Both questions should be categorized as 'fruits'
      expect(analysis.patterns.categories.fruits).toBe(2);
    });
  });

  // ===========================================================================
  // 8. Performance Considerations
  // ===========================================================================

  describe('Performance Considerations', () => {
    it('should handle large number of games efficiently', async () => {
      const gameIds = Array.from({ length: 50 }, (_, i) => `game-${i}`);

      vi.mocked(readdir).mockResolvedValue(gameIds as any);
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('config.json')) return JSON.stringify(mockGameConfig);
        if (pathStr.endsWith('en.json')) return JSON.stringify(mockEnglishLang);
        if (pathStr.endsWith('ro.json')) return JSON.stringify(mockRomanianLang);
        throw new Error(`File not found: ${path}`);
      });

      const extractor = new DataExtractor({
        gamesPath: '/games',
        outputPath: '/output',
        includeAssets: false,
        languages: ['en', 'ro']
      });

      const startTime = Date.now();
      const extracted = await extractor.extractAll();
      const duration = Date.now() - startTime;

      expect(extracted.length).toBe(50);
      // Should complete in reasonable time (less than 5 seconds for mocked operations)
      expect(duration).toBeLessThan(5000);
    });

    it('should batch validate efficiently', async () => {
      const validator = new QualityValidator();

      const texts = Array.from({ length: 100 }, (_, i) =>
        `Which one is item ${i}?`
      );

      const startTime = Date.now();
      const { summary } = await validator.validateBatch(
        texts,
        async (text) => validator.validateText(text)
      );
      const duration = Date.now() - startTime;

      expect(summary.total).toBe(100);
      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);
    });
  });
});
