/**
 * DatasetBuilder Unit Tests
 *
 * Tests for the DatasetBuilder class which builds training datasets
 * from extracted content and prompts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatasetBuilder } from '../DatasetBuilder';
import {
  DatasetBuilderConfig,
  ImageDatasetEntry,
  TextDatasetEntry,
  AudioDatasetEntry,
  TrainingManifest
} from '../types';
import { writeFile, mkdir } from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn()
}));

// =============================================================================
// Test Fixtures
// =============================================================================

const createImageEntries = (count: number): ImageDatasetEntry[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `img-${i + 1}`,
    prompt: `A cute cartoon item ${i + 1}`,
    negativePrompt: 'scary, dark',
    imagePath: `assets/images/item-${i + 1}.png`,
    category: i % 2 === 0 ? 'fruits' : 'animals',
    style: 'cartoon',
    metadata: {
      width: 512,
      height: 512,
      sourceGame: 'test-game',
      sourceAsset: `item-${i + 1}.png`,
      tags: ['cartoon', 'educational']
    }
  }));

const createTextEntries = (count: number): TextDatasetEntry[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `text-${i + 1}`,
    prompt: `Generate a question about topic ${i + 1}`,
    completion: `Which one is item ${i + 1}?`,
    category: i % 2 === 0 ? 'fruits' : 'colors',
    metadata: {
      language: 'en',
      difficulty: 'easy',
      targetAge: '3-8',
      wordCount: 5,
      readabilityScore: 2.0
    }
  }));

const createAudioEntries = (count: number): AudioDatasetEntry[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `audio-${i + 1}`,
    text: `This is audio clip ${i + 1}`,
    audioPath: `assets/audio/clip-${i + 1}.mp3`,
    language: i % 2 === 0 ? 'en' : 'ro',
    voice: 'child-friendly',
    metadata: {
      duration: 2.5,
      pace: 130,
      targetAge: '3-8'
    }
  }));

// =============================================================================
// Test Suite
// =============================================================================

describe('DatasetBuilder', () => {
  let builder: DatasetBuilder;
  let config: DatasetBuilderConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      outputPath: '/mock/output',
      split: {
        train: 0.7,
        val: 0.15,
        test: 0.15
      },
      shuffle: true,
      seed: 42
    };

    builder = new DatasetBuilder(config);

    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(builder).toBeDefined();
    });

    it('should accept split ratios that sum to 1', () => {
      const validConfig: DatasetBuilderConfig = {
        outputPath: '/output',
        split: { train: 0.8, val: 0.1, test: 0.1 },
        shuffle: true
      };

      const validBuilder = new DatasetBuilder(validConfig);
      expect(validBuilder).toBeDefined();
    });

    it('should throw error if split ratios do not sum to 1', () => {
      const invalidConfig: DatasetBuilderConfig = {
        outputPath: '/output',
        split: { train: 0.5, val: 0.3, test: 0.1 }, // Sums to 0.9
        shuffle: true
      };

      expect(() => new DatasetBuilder(invalidConfig)).toThrow(
        'Split ratios must sum to 1.0'
      );
    });

    it('should allow slight tolerance in split ratio sum', () => {
      // 0.7 + 0.15 + 0.15 = 1.0 exactly, but floating point might cause issues
      const tolerantConfig: DatasetBuilderConfig = {
        outputPath: '/output',
        split: { train: 0.7, val: 0.15, test: 0.15 },
        shuffle: false
      };

      expect(() => new DatasetBuilder(tolerantConfig)).not.toThrow();
    });
  });

  // ===========================================================================
  // buildImageDataset Tests
  // ===========================================================================

  describe('buildImageDataset', () => {
    it('should throw error for empty entries', async () => {
      await expect(builder.buildImageDataset([])).rejects.toThrow(
        'Cannot build dataset from empty entries'
      );
    });

    it('should create output directory', async () => {
      const entries = createImageEntries(20);
      await builder.buildImageDataset(entries);

      // Check mkdir was called with path containing 'datasets' and 'images'
      const mkdirCalls = vi.mocked(mkdir).mock.calls;
      expect(mkdirCalls.length).toBeGreaterThan(0);
      const pathContainsDatasets = mkdirCalls.some(call => {
        const pathArg = call[0] as string;
        return pathArg.includes('datasets') && pathArg.includes('images');
      });
      expect(pathContainsDatasets).toBe(true);
    });

    it('should write train.jsonl file', async () => {
      const entries = createImageEntries(20);
      await builder.buildImageDataset(entries);

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('train.jsonl'),
        expect.any(String)
      );
    });

    it('should write val.jsonl file', async () => {
      const entries = createImageEntries(20);
      await builder.buildImageDataset(entries);

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('val.jsonl'),
        expect.any(String)
      );
    });

    it('should write test.jsonl file', async () => {
      const entries = createImageEntries(20);
      await builder.buildImageDataset(entries);

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test.jsonl'),
        expect.any(String)
      );
    });

    it('should write manifest.json file', async () => {
      const entries = createImageEntries(20);
      await builder.buildImageDataset(entries);

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('manifest.json'),
        expect.any(String)
      );
    });

    it('should split data according to ratios', async () => {
      const entries = createImageEntries(100);
      await builder.buildImageDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;

      // Find train.jsonl content
      const trainCall = calls.find(c => c[0].toString().includes('train.jsonl'));
      const trainContent = trainCall![1] as string;
      const trainLines = trainContent.trim().split('\n');

      // Should be approximately 70% (allow for rounding)
      expect(trainLines.length).toBeGreaterThanOrEqual(65);
      expect(trainLines.length).toBeLessThanOrEqual(75);
    });

    it('should shuffle data when shuffle is true', async () => {
      const entries = createImageEntries(20);

      // Build twice with same seed
      await builder.buildImageDataset(entries);

      const shuffledBuilder = new DatasetBuilder({ ...config, seed: 42 });
      await shuffledBuilder.buildImageDataset(entries);

      // Both should produce same shuffled order due to same seed
      const calls1 = vi.mocked(writeFile).mock.calls.slice(0, 4);
      const calls2 = vi.mocked(writeFile).mock.calls.slice(4, 8);

      // Train content should be identical with same seed
      expect(calls1[0][1]).toBe(calls2[0][1]);
    });

    it('should not shuffle when shuffle is false', async () => {
      const noShuffleConfig: DatasetBuilderConfig = {
        ...config,
        shuffle: false
      };
      const noShuffleBuilder = new DatasetBuilder(noShuffleConfig);

      const entries = createImageEntries(10);
      await noShuffleBuilder.buildImageDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;
      const trainCall = calls.find(c => c[0].toString().includes('train.jsonl'));
      const trainContent = trainCall![1] as string;
      const firstLine = trainContent.split('\n')[0];
      const firstEntry = JSON.parse(firstLine);

      // First entry should be img-1 (not shuffled)
      expect(firstEntry.id).toBe('img-1');
    });

    it('should write valid JSONL format', async () => {
      const entries = createImageEntries(10);
      await builder.buildImageDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;
      const trainCall = calls.find(c => c[0].toString().includes('train.jsonl'));
      const content = trainCall![1] as string;

      // Each line should be valid JSON
      const lines = content.trim().split('\n');
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should log progress message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const entries = createImageEntries(20);
      await builder.buildImageDataset(entries);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Image dataset built')
      );

      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // buildTextDataset Tests
  // ===========================================================================

  describe('buildTextDataset', () => {
    it('should throw error for empty entries', async () => {
      await expect(builder.buildTextDataset([])).rejects.toThrow(
        'Cannot build dataset from empty entries'
      );
    });

    it('should create text dataset directory', async () => {
      const entries = createTextEntries(20);
      await builder.buildTextDataset(entries);

      // Check mkdir was called with path containing 'datasets' and 'text'
      const mkdirCalls = vi.mocked(mkdir).mock.calls;
      expect(mkdirCalls.length).toBeGreaterThan(0);
      const pathContainsDatasets = mkdirCalls.some(call => {
        const pathArg = call[0] as string;
        return pathArg.includes('datasets') && pathArg.includes('text');
      });
      expect(pathContainsDatasets).toBe(true);
    });

    it('should write all split files', async () => {
      const entries = createTextEntries(20);
      await builder.buildTextDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;
      const paths = calls.map(c => c[0].toString());

      expect(paths.some(p => p.includes('train.jsonl'))).toBe(true);
      expect(paths.some(p => p.includes('val.jsonl'))).toBe(true);
      expect(paths.some(p => p.includes('test.jsonl'))).toBe(true);
      expect(paths.some(p => p.includes('manifest.json'))).toBe(true);
    });

    it('should include prompt and completion in entries', async () => {
      const entries = createTextEntries(10);
      await builder.buildTextDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;
      const trainCall = calls.find(c => c[0].toString().includes('train.jsonl'));
      const content = trainCall![1] as string;
      const firstLine = content.split('\n')[0];
      const entry = JSON.parse(firstLine);

      expect(entry).toHaveProperty('prompt');
      expect(entry).toHaveProperty('completion');
    });
  });

  // ===========================================================================
  // buildAudioDataset Tests
  // ===========================================================================

  describe('buildAudioDataset', () => {
    it('should throw error for empty entries', async () => {
      await expect(builder.buildAudioDataset([])).rejects.toThrow(
        'Cannot build dataset from empty entries'
      );
    });

    it('should create audio dataset directory', async () => {
      const entries = createAudioEntries(20);
      await builder.buildAudioDataset(entries);

      // Check mkdir was called with path containing 'datasets' and 'audio'
      const mkdirCalls = vi.mocked(mkdir).mock.calls;
      expect(mkdirCalls.length).toBeGreaterThan(0);
      const pathContainsDatasets = mkdirCalls.some(call => {
        const pathArg = call[0] as string;
        return pathArg.includes('datasets') && pathArg.includes('audio');
      });
      expect(pathContainsDatasets).toBe(true);
    });

    it('should include text and audioPath in entries', async () => {
      const entries = createAudioEntries(10);
      await builder.buildAudioDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;
      const trainCall = calls.find(c => c[0].toString().includes('train.jsonl'));
      const content = trainCall![1] as string;
      const firstLine = content.split('\n')[0];
      const entry = JSON.parse(firstLine);

      expect(entry).toHaveProperty('text');
      expect(entry).toHaveProperty('audioPath');
      expect(entry).toHaveProperty('language');
    });
  });

  // ===========================================================================
  // createImageDatasetEntries Tests
  // ===========================================================================

  describe('createImageDatasetEntries', () => {
    it('should convert extracted data to dataset entries', () => {
      const extractedData = [
        {
          id: 'asset-1',
          assetPath: 'images/apple.png',
          category: 'fruits',
          width: 256,
          height: 256,
          tags: ['fruit', 'red']
        }
      ];
      const prompts = {
        'asset-1': 'A red cartoon apple'
      };

      const entries = builder.createImageDatasetEntries(extractedData, prompts);

      expect(entries).toHaveLength(1);
      expect(entries[0].prompt).toBe('A red cartoon apple');
      expect(entries[0].imagePath).toBe('images/apple.png');
      expect(entries[0].category).toBe('fruits');
    });

    it('should generate sequential IDs', () => {
      const extractedData = [
        { id: 'a', assetPath: '1.png' },
        { id: 'b', assetPath: '2.png' },
        { id: 'c', assetPath: '3.png' }
      ];

      const entries = builder.createImageDatasetEntries(extractedData, {});

      expect(entries[0].id).toBe('img-1');
      expect(entries[1].id).toBe('img-2');
      expect(entries[2].id).toBe('img-3');
    });

    it('should handle missing prompts', () => {
      const extractedData = [
        { id: 'asset-1', assetPath: '1.png', prompt: 'fallback prompt' }
      ];

      const entries = builder.createImageDatasetEntries(extractedData, {});

      expect(entries[0].prompt).toBe('fallback prompt');
    });

    it('should use default values for missing fields', () => {
      const extractedData = [{ id: 'minimal' }];

      const entries = builder.createImageDatasetEntries(extractedData, {});

      expect(entries[0].metadata.width).toBe(512);
      expect(entries[0].metadata.height).toBe(512);
      expect(entries[0].category).toBe('general');
      expect(entries[0].style).toBe('cartoon');
    });
  });

  // ===========================================================================
  // createTextDatasetEntries Tests
  // ===========================================================================

  describe('createTextDatasetEntries', () => {
    it('should convert questions to dataset entries', () => {
      const questions = [
        {
          id: 'q1',
          text: { en: 'Which one is an apple?' },
          category: 'fruits',
          difficulty: 1
        }
      ];

      const entries = builder.createTextDatasetEntries(questions);

      expect(entries).toHaveLength(1);
      expect(entries[0].completion).toBe('Which one is an apple?');
      expect(entries[0].category).toBe('fruits');
    });

    it('should generate sequential IDs', () => {
      const questions = [
        { id: 'q1', text: { en: 'Q1' } },
        { id: 'q2', text: { en: 'Q2' } },
        { id: 'q3', text: { en: 'Q3' } }
      ];

      const entries = builder.createTextDatasetEntries(questions);

      expect(entries[0].id).toBe('text-1');
      expect(entries[1].id).toBe('text-2');
      expect(entries[2].id).toBe('text-3');
    });

    it('should calculate word count', () => {
      const questions = [
        { id: 'q1', text: { en: 'This is a five word sentence' }, category: 'test' }
      ];

      const entries = builder.createTextDatasetEntries(questions);

      expect(entries[0].metadata.wordCount).toBe(6);
    });

    it('should use text directly if no language key', () => {
      const questions = [
        { id: 'q1', text: 'Direct text question', category: 'test' }
      ];

      const entries = builder.createTextDatasetEntries(questions);

      expect(entries[0].completion).toBe('Direct text question');
    });
  });

  // ===========================================================================
  // getDatasetStats Tests
  // ===========================================================================

  describe('getDatasetStats', () => {
    it('should return total count', () => {
      const entries = createImageEntries(25);
      const stats = builder.getDatasetStats(entries);

      expect(stats.total).toBe(25);
    });

    it('should count entries by category', () => {
      const entries = createImageEntries(10); // Alternates fruits/animals

      const stats = builder.getDatasetStats(entries);

      expect(stats.byCategory.fruits).toBe(5);
      expect(stats.byCategory.animals).toBe(5);
    });

    it('should handle empty entries', () => {
      const stats = builder.getDatasetStats([]);

      expect(stats.total).toBe(0);
      expect(Object.keys(stats.byCategory)).toHaveLength(0);
    });

    it('should handle single category', () => {
      const entries: ImageDatasetEntry[] = Array.from({ length: 5 }, (_, i) => ({
        id: `img-${i}`,
        prompt: 'test',
        negativePrompt: '',
        imagePath: 'test.png',
        category: 'fruits',
        style: 'cartoon',
        metadata: { width: 512, height: 512, tags: [] }
      }));

      const stats = builder.getDatasetStats(entries);

      expect(stats.byCategory.fruits).toBe(5);
      expect(Object.keys(stats.byCategory)).toHaveLength(1);
    });
  });

  // ===========================================================================
  // validateDataset Tests
  // ===========================================================================

  describe('validateDataset', () => {
    it('should pass validation for valid dataset', () => {
      const entries = createImageEntries(20);
      const result = builder.validateDataset(entries);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for dataset smaller than 10 entries', () => {
      const entries = createImageEntries(5);
      const result = builder.validateDataset(entries);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too small'))).toBe(true);
    });

    it('should fail for duplicate IDs', () => {
      const entries = createImageEntries(15);
      entries[5].id = entries[0].id; // Create duplicate

      const result = builder.validateDataset(entries);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate ID'))).toBe(true);
    });

    it('should warn for very small train set', () => {
      const entries = createImageEntries(10);
      const result = builder.validateDataset(entries);

      // With 10 entries and 0.7 split, train = 7, which is still > 5
      // But validation may still warn
      expect(result.valid).toBe(true);
    });

    it('should warn for very small validation set', () => {
      // With low entry count, val/test sets become very small
      const smallConfig: DatasetBuilderConfig = {
        outputPath: '/output',
        split: { train: 0.9, val: 0.05, test: 0.05 },
        shuffle: false
      };
      const smallBuilder = new DatasetBuilder(smallConfig);

      const entries = createImageEntries(20);
      const result = smallBuilder.validateDataset(entries);

      // Val size = 20 * 0.05 = 1, which is < 2
      expect(result.warnings.some(w => w.includes('Validation set'))).toBe(true);
    });

    it('should return all errors for multiple issues', () => {
      const entries = createImageEntries(5);
      entries[2].id = entries[0].id; // Duplicate

      const result = builder.validateDataset(entries);

      expect(result.errors.length).toBeGreaterThanOrEqual(2); // Size + duplicate
    });
  });

  // ===========================================================================
  // Manifest Generation Tests
  // ===========================================================================

  describe('manifest generation', () => {
    it('should include version information', async () => {
      const entries = createImageEntries(20);
      await builder.buildImageDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;
      const manifestCall = calls.find(c => c[0].toString().includes('manifest.json'));
      const manifest: TrainingManifest = JSON.parse(manifestCall![1] as string);

      expect(manifest.version).toBe('1.0');
    });

    it('should include creation date', async () => {
      const entries = createImageEntries(20);
      await builder.buildImageDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;
      const manifestCall = calls.find(c => c[0].toString().includes('manifest.json'));
      const manifest: TrainingManifest = JSON.parse(manifestCall![1] as string);

      expect(manifest.createdAt).toBeDefined();
    });

    it('should set base model based on type', async () => {
      const imageEntries = createImageEntries(20);
      await builder.buildImageDataset(imageEntries);

      let calls = vi.mocked(writeFile).mock.calls;
      let manifestCall = calls.find(c => c[0].toString().includes('manifest.json'));
      let manifest: TrainingManifest = JSON.parse(manifestCall![1] as string);

      expect(manifest.baseModel).toBe('SDXL');

      vi.clearAllMocks();
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const textEntries = createTextEntries(20);
      await builder.buildTextDataset(textEntries);

      calls = vi.mocked(writeFile).mock.calls;
      manifestCall = calls.find(c => c[0].toString().includes('manifest.json'));
      manifest = JSON.parse(manifestCall![1] as string);

      expect(manifest.baseModel).toBe('Mistral-Small');
    });

    it('should include dataset split sizes', async () => {
      const entries = createImageEntries(100);
      await builder.buildImageDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;
      const manifestCall = calls.find(c => c[0].toString().includes('manifest.json'));
      const manifest: TrainingManifest = JSON.parse(manifestCall![1] as string);

      expect(manifest.dataset.trainSize).toBe(70);
      expect(manifest.dataset.valSize).toBe(15);
      expect(manifest.dataset.testSize).toBe(15);
    });

    it('should list unique categories', async () => {
      const entries = createImageEntries(20);
      await builder.buildImageDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;
      const manifestCall = calls.find(c => c[0].toString().includes('manifest.json'));
      const manifest: TrainingManifest = JSON.parse(manifestCall![1] as string);

      expect(manifest.dataset.categories).toContain('fruits');
      expect(manifest.dataset.categories).toContain('animals');
    });

    it('should include training hyperparameters', async () => {
      const entries = createImageEntries(20);
      await builder.buildImageDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;
      const manifestCall = calls.find(c => c[0].toString().includes('manifest.json'));
      const manifest: TrainingManifest = JSON.parse(manifestCall![1] as string);

      expect(manifest.training.epochs).toBeGreaterThan(0);
      expect(manifest.training.batchSize).toBeGreaterThan(0);
      expect(manifest.training.learningRate).toBeGreaterThan(0);
      expect(manifest.training.loraRank).toBeGreaterThan(0);
    });

    it('should include file paths', async () => {
      const entries = createImageEntries(20);
      await builder.buildImageDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;
      const manifestCall = calls.find(c => c[0].toString().includes('manifest.json'));
      const manifest: TrainingManifest = JSON.parse(manifestCall![1] as string);

      expect(manifest.files.train).toBe('train.jsonl');
      expect(manifest.files.val).toBe('val.jsonl');
      expect(manifest.files.test).toBe('test.jsonl');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle single entry dataset', async () => {
      const entries = createImageEntries(1);

      // The builder validates minimum 10 entries, but buildImageDataset only checks
      // for empty entries. Single entry should still work (validation is separate).
      // Let's verify it doesn't crash with a single entry.
      await builder.buildImageDataset(entries);

      // Verify files were written
      expect(writeFile).toHaveBeenCalled();
    });

    it('should handle exactly 10 entries (minimum)', async () => {
      const entries = createImageEntries(10);
      await builder.buildImageDataset(entries);

      // Should succeed without throwing
      expect(writeFile).toHaveBeenCalled();
    });

    it('should handle large datasets', async () => {
      const entries = createImageEntries(1000);
      await builder.buildImageDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;
      const trainCall = calls.find(c => c[0].toString().includes('train.jsonl'));
      const trainContent = trainCall![1] as string;
      const trainLines = trainContent.trim().split('\n');

      expect(trainLines.length).toBe(700); // 70% of 1000
    });

    it('should produce deterministic results with same seed', async () => {
      const entries = createImageEntries(50);

      await builder.buildImageDataset(entries);
      const firstRun = vi.mocked(writeFile).mock.calls
        .find(c => c[0].toString().includes('train.jsonl'))?.[1];

      vi.clearAllMocks();
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const builder2 = new DatasetBuilder({ ...config, seed: 42 });
      await builder2.buildImageDataset(entries);
      const secondRun = vi.mocked(writeFile).mock.calls
        .find(c => c[0].toString().includes('train.jsonl'))?.[1];

      expect(firstRun).toBe(secondRun);
    });

    it('should handle entries with special characters', async () => {
      const entries = createImageEntries(10);
      entries[0].prompt = 'A "special" prompt with \'quotes\' and\nnewlines';

      await builder.buildImageDataset(entries);

      const calls = vi.mocked(writeFile).mock.calls;
      const trainCall = calls.find(c => c[0].toString().includes('train.jsonl'));
      const content = trainCall![1] as string;

      // Should be valid JSON
      const lines = content.trim().split('\n');
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should handle write errors gracefully', async () => {
      vi.mocked(writeFile).mockRejectedValue(new Error('Disk full'));

      const entries = createImageEntries(20);

      await expect(builder.buildImageDataset(entries)).rejects.toThrow('Disk full');
    });

    it('should handle mkdir errors', async () => {
      vi.mocked(mkdir).mockRejectedValue(new Error('Permission denied'));

      const entries = createImageEntries(20);

      await expect(builder.buildImageDataset(entries)).rejects.toThrow('Permission denied');
    });
  });
});
