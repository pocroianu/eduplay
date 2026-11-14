/**
 * Dataset Builder
 *
 * Builds training datasets from extracted content and prompts.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  ImageDatasetEntry,
  TextDatasetEntry,
  AudioDatasetEntry,
  TrainingManifest,
  DatasetBuilderConfig
} from './types';

/**
 * Builds training datasets from extracted content and prompts.
 *
 * Responsibilities:
 * - Split data into train/val/test
 * - Generate image-caption pairs
 * - Generate prompt-completion pairs
 * - Export to JSONL format
 * - Create training manifests
 */
export class DatasetBuilder {
  constructor(private config: DatasetBuilderConfig) {
    // Validate split ratios sum to 1
    const sum = this.config.split.train + this.config.split.val + this.config.split.test;
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(`Split ratios must sum to 1.0, got ${sum}`);
    }
  }

  /**
   * Build image dataset for LoRA training
   */
  async buildImageDataset(entries: ImageDatasetEntry[]): Promise<void> {
    if (entries.length === 0) {
      throw new Error('Cannot build dataset from empty entries');
    }

    // Shuffle if enabled
    const shuffled = this.config.shuffle
      ? this.shuffleArray(entries, this.config.seed)
      : entries;

    // Split into train/val/test
    const splits = this.splitDataset(shuffled);

    // Create output directory
    const outputDir = join(this.config.outputPath, 'datasets', 'images');
    await mkdir(outputDir, { recursive: true });

    // Write JSONL files
    await this.writeJSONL(join(outputDir, 'train.jsonl'), splits.train);
    await this.writeJSONL(join(outputDir, 'val.jsonl'), splits.val);
    await this.writeJSONL(join(outputDir, 'test.jsonl'), splits.test);

    // Generate manifest
    const manifest = this.createManifest('image', splits, entries[0]);
    await writeFile(
      join(outputDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log(`✅ Image dataset built:`);
    console.log(`   Train: ${splits.train.length} entries`);
    console.log(`   Val: ${splits.val.length} entries`);
    console.log(`   Test: ${splits.test.length} entries`);
  }

  /**
   * Build text dataset
   */
  async buildTextDataset(entries: TextDatasetEntry[]): Promise<void> {
    if (entries.length === 0) {
      throw new Error('Cannot build dataset from empty entries');
    }

    const shuffled = this.config.shuffle
      ? this.shuffleArray(entries, this.config.seed)
      : entries;

    const splits = this.splitDataset(shuffled);

    const outputDir = join(this.config.outputPath, 'datasets', 'text');
    await mkdir(outputDir, { recursive: true });

    await this.writeJSONL(join(outputDir, 'train.jsonl'), splits.train);
    await this.writeJSONL(join(outputDir, 'val.jsonl'), splits.val);
    await this.writeJSONL(join(outputDir, 'test.jsonl'), splits.test);

    const manifest = this.createManifest('text', splits, entries[0]);
    await writeFile(
      join(outputDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log(`✅ Text dataset built:`);
    console.log(`   Train: ${splits.train.length} entries`);
    console.log(`   Val: ${splits.val.length} entries`);
    console.log(`   Test: ${splits.test.length} entries`);
  }

  /**
   * Build audio dataset
   */
  async buildAudioDataset(entries: AudioDatasetEntry[]): Promise<void> {
    if (entries.length === 0) {
      throw new Error('Cannot build dataset from empty entries');
    }

    const shuffled = this.config.shuffle
      ? this.shuffleArray(entries, this.config.seed)
      : entries;

    const splits = this.splitDataset(shuffled);

    const outputDir = join(this.config.outputPath, 'datasets', 'audio');
    await mkdir(outputDir, { recursive: true });

    await this.writeJSONL(join(outputDir, 'train.jsonl'), splits.train);
    await this.writeJSONL(join(outputDir, 'val.jsonl'), splits.val);
    await this.writeJSONL(join(outputDir, 'test.jsonl'), splits.test);

    const manifest = this.createManifest('audio', splits, entries[0]);
    await writeFile(
      join(outputDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log(`✅ Audio dataset built:`);
    console.log(`   Train: ${splits.train.length} entries`);
    console.log(`   Val: ${splits.val.length} entries`);
    console.log(`   Test: ${splits.test.length} entries`);
  }

  /**
   * Convert extracted data to dataset entries
   */
  createImageDatasetEntries(
    extractedData: any[],
    prompts: Record<string, string>
  ): ImageDatasetEntry[] {
    const entries: ImageDatasetEntry[] = [];
    let idCounter = 1;

    for (const data of extractedData) {
      const entry: ImageDatasetEntry = {
        id: `img-${idCounter++}`,
        prompt: prompts[data.id] || data.prompt || '',
        negativePrompt: data.negativePrompt || '',
        imagePath: data.assetPath || data.imagePath || '',
        category: data.category || 'general',
        style: data.style || 'cartoon',
        metadata: {
          width: data.width || 512,
          height: data.height || 512,
          sourceGame: data.gameId,
          sourceAsset: data.assetPath,
          tags: data.tags || []
        }
      };

      entries.push(entry);
    }

    return entries;
  }

  /**
   * Create text dataset entries
   */
  createTextDatasetEntries(
    extractedQuestions: any[]
  ): TextDatasetEntry[] {
    const entries: TextDatasetEntry[] = [];
    let idCounter = 1;

    for (const question of extractedQuestions) {
      const entry: TextDatasetEntry = {
        id: `text-${idCounter++}`,
        prompt: `Generate a question about ${question.category}`,
        completion: question.text.en || question.text,
        category: question.category || 'general',
        metadata: {
          language: 'en',
          difficulty: question.difficulty?.toString() || 'easy',
          targetAge: '3-8',
          wordCount: (question.text.en || question.text).split(/\s+/).length,
          readabilityScore: 0 // To be calculated by validator
        }
      };

      entries.push(entry);
    }

    return entries;
  }

  // Private methods

  /**
   * Split dataset into train/val/test
   */
  private splitDataset<T>(entries: T[]): { train: T[], val: T[], test: T[] } {
    const total = entries.length;
    const trainSize = Math.floor(total * this.config.split.train);
    const valSize = Math.floor(total * this.config.split.val);

    return {
      train: entries.slice(0, trainSize),
      val: entries.slice(trainSize, trainSize + valSize),
      test: entries.slice(trainSize + valSize)
    };
  }

  /**
   * Shuffle array with optional seed
   */
  private shuffleArray<T>(array: T[], seed?: number): T[] {
    const shuffled = [...array];

    // Seeded random if provided
    const random = seed !== undefined
      ? this.seededRandom(seed)
      : Math.random;

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  /**
   * Create seeded random number generator
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }

  /**
   * Write entries to JSONL file
   */
  private async writeJSONL<T>(path: string, entries: T[]): Promise<void> {
    const lines = entries.map(entry => JSON.stringify(entry));
    await writeFile(path, lines.join('\n') + '\n');
  }

  /**
   * Create training manifest
   */
  private createManifest(
    type: string,
    splits: { train: any[], val: any[], test: any[] },
    sampleEntry: any
  ): TrainingManifest {
    return {
      version: '1.0',
      createdAt: new Date(),
      baseModel: type === 'image' ? 'SDXL' : 'Mistral-Small',
      dataset: {
        trainSize: splits.train.length,
        valSize: splits.val.length,
        testSize: splits.test.length,
        categories: this.extractCategories(splits.train)
      },
      training: {
        epochs: type === 'image' ? 100 : 10,
        batchSize: type === 'image' ? 4 : 8,
        learningRate: 1e-4,
        loraRank: 16,
        loraAlpha: 32
      },
      validation: {
        minQualityScore: 80,
        passRate: 0.8
      },
      files: {
        train: 'train.jsonl',
        val: 'val.jsonl',
        test: 'test.jsonl',
        prompts: `../prompts/${type}-prompts.json`
      }
    };
  }

  /**
   * Extract unique categories from entries
   */
  private extractCategories(entries: any[]): string[] {
    const categories = new Set<string>();

    for (const entry of entries) {
      if (entry.category) {
        categories.add(entry.category);
      }
    }

    return Array.from(categories).sort();
  }

  /**
   * Get dataset statistics
   */
  getDatasetStats<T extends { category: string }>(
    entries: T[]
  ): {
    total: number;
    byCategory: Record<string, number>;
  } {
    const stats = {
      total: entries.length,
      byCategory: {} as Record<string, number>
    };

    for (const entry of entries) {
      stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
    }

    return stats;
  }

  /**
   * Validate dataset before building
   */
  validateDataset<T extends { id: string }>(entries: T[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check minimum size
    if (entries.length < 10) {
      errors.push(`Dataset too small: ${entries.length} entries (minimum 10)`);
    }

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const entry of entries) {
      if (ids.has(entry.id)) {
        errors.push(`Duplicate ID found: ${entry.id}`);
      }
      ids.add(entry.id);
    }

    // Check split viability
    const trainSize = Math.floor(entries.length * this.config.split.train);
    const valSize = Math.floor(entries.length * this.config.split.val);
    const testSize = Math.floor(entries.length * this.config.split.test);

    if (trainSize < 5) {
      warnings.push(`Train set will be very small: ${trainSize} entries`);
    }
    if (valSize < 2) {
      warnings.push(`Validation set will be very small: ${valSize} entries`);
    }
    if (testSize < 2) {
      warnings.push(`Test set will be very small: ${testSize} entries`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
