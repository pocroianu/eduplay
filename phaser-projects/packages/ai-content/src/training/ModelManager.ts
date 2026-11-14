/**
 * Model Manager
 *
 * Manages LoRA model lifecycle: listing, loading, exporting, and deleting models.
 * Handles model metadata and integrity verification.
 */

import { createHash } from 'crypto';
import { readFile, writeFile, readdir, stat, unlink, mkdir, copyFile } from 'fs/promises';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';
import { createReadStream } from 'fs';
import type {
  LoRAModel,
  LoRATrainingConfig,
  TrainingResult,
  BaseModel,
  ModelExportOptions,
  TrainingJobFilter,
} from './types';

/**
 * Model manager configuration
 */
export interface ModelManagerConfig {
  lorasDir: string; // Directory for LoRA models (default: ./loras)
  metadataDir: string; // Directory for metadata (default: ./loras/metadata)
}

/**
 * Model filter options
 */
export interface ModelFilter {
  baseModel?: BaseModel;
  tags?: string[];
  namePattern?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  minSize?: number; // bytes
  maxSize?: number; // bytes
}

/**
 * Model statistics
 */
export interface ModelStats {
  totalModels: number;
  totalSize: number; // bytes
  baseModelCounts: Record<string, number>;
  averageSize: number;
  oldestModel?: Date;
  newestModel?: Date;
}

/**
 * Manages LoRA models with metadata and lifecycle operations
 */
export class ModelManager {
  private config: ModelManagerConfig;
  private modelCache: Map<string, LoRAModel> = new Map();
  private cacheExpiry: number = 60000; // 1 minute
  private lastCacheUpdate: number = 0;

  constructor(config?: Partial<ModelManagerConfig>) {
    const lorasDir = config?.lorasDir || join(process.cwd(), 'loras');

    this.config = {
      lorasDir,
      metadataDir: config?.metadataDir || join(lorasDir, 'metadata'),
    };
  }

  /**
   * Initialize model manager (create directories)
   */
  async init(): Promise<void> {
    await this.ensureDirectories();
  }

  /**
   * List all available LoRA models
   */
  async listModels(filter?: ModelFilter): Promise<LoRAModel[]> {
    await this.refreshCacheIfNeeded();

    let models = Array.from(this.modelCache.values());

    // Apply filters
    if (filter) {
      models = this.applyFilters(models, filter);
    }

    return models;
  }

  /**
   * Get a specific model by ID
   */
  async getModel(id: string): Promise<LoRAModel | null> {
    await this.refreshCacheIfNeeded();

    return this.modelCache.get(id) || null;
  }

  /**
   * Get a specific model by name
   */
  async getModelByName(name: string): Promise<LoRAModel | null> {
    const models = await this.listModels({ namePattern: name });
    return models.length > 0 ? models[0] : null;
  }

  /**
   * Save model metadata after training
   */
  async saveModel(config: LoRATrainingConfig, result: TrainingResult, tags?: string[]): Promise<LoRAModel> {
    await this.ensureDirectories();

    // Generate model ID from name and timestamp
    const timestamp = Date.now();
    const id = `${config.name}-${timestamp}`;

    // Calculate checksum
    const checksum = await this.calculateChecksum(result.loraPath);

    // Get file size
    const stats = await stat(result.loraPath);

    // Create model metadata
    const model: LoRAModel = {
      id,
      name: config.name,
      version: '1.0.0',
      path: result.loraPath,
      size: stats.size,
      checksum,
      baseModel: config.baseModel,
      trainingConfig: config,
      trainingResult: result,
      description: config.description,
      tags: tags || [],
      createdAt: new Date(),
      generationCount: 0,
    };

    // Save metadata
    await this.saveMetadata(model);

    // Update cache
    this.modelCache.set(id, model);

    return model;
  }

  /**
   * Export model with metadata and optional checkpoints
   */
  async exportModel(id: string, outputDir: string, options?: Partial<ModelExportOptions>): Promise<string> {
    const model = await this.getModel(id);

    if (!model) {
      throw new Error(`Model not found: ${id}`);
    }

    const exportOptions: ModelExportOptions = {
      includeMetadata: options?.includeMetadata ?? true,
      includeCheckpoints: options?.includeCheckpoints ?? false,
      includeValidationImages: options?.includeValidationImages ?? false,
    };

    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true });

    // Export main model file
    const modelFileName = basename(model.path);
    const exportedModelPath = join(outputDir, modelFileName);
    await copyFile(model.path, exportedModelPath);

    // Export metadata if requested
    if (exportOptions.includeMetadata) {
      const metadataPath = join(outputDir, `${model.name}-metadata.json`);
      await writeFile(metadataPath, JSON.stringify(model, null, 2), 'utf-8');
    }

    // Export checkpoints if requested
    if (exportOptions.includeCheckpoints && model.trainingResult.checkpoints) {
      const checkpointsDir = join(outputDir, 'checkpoints');
      await mkdir(checkpointsDir, { recursive: true });

      for (const checkpoint of model.trainingResult.checkpoints) {
        if (existsSync(checkpoint)) {
          const checkpointName = basename(checkpoint);
          await copyFile(checkpoint, join(checkpointsDir, checkpointName));
        }
      }
    }

    // Export validation images if requested
    if (exportOptions.includeValidationImages && model.trainingResult.validationMetrics) {
      const validationDir = join(outputDir, 'validation');
      await mkdir(validationDir, { recursive: true });

      for (const metrics of model.trainingResult.validationMetrics) {
        for (const prompt of metrics.prompts) {
          if (existsSync(prompt.imagePath)) {
            const imageName = basename(prompt.imagePath);
            await copyFile(prompt.imagePath, join(validationDir, imageName));
          }
        }
      }
    }

    return exportedModelPath;
  }

  /**
   * Delete a model and its metadata
   */
  async deleteModel(id: string, deleteCheckpoints: boolean = true): Promise<void> {
    const model = await this.getModel(id);

    if (!model) {
      throw new Error(`Model not found: ${id}`);
    }

    // Delete main model file
    if (existsSync(model.path)) {
      await unlink(model.path);
    }

    // Delete checkpoints if requested
    if (deleteCheckpoints && model.trainingResult.checkpoints) {
      for (const checkpoint of model.trainingResult.checkpoints) {
        if (existsSync(checkpoint)) {
          await unlink(checkpoint);
        }
      }
    }

    // Delete metadata
    await this.deleteMetadata(id);

    // Remove from cache
    this.modelCache.delete(id);
  }

  /**
   * Update model metadata (e.g., increment generation count)
   */
  async updateModel(id: string, updates: Partial<LoRAModel>): Promise<LoRAModel> {
    const model = await this.getModel(id);

    if (!model) {
      throw new Error(`Model not found: ${id}`);
    }

    // Apply updates
    const updatedModel: LoRAModel = {
      ...model,
      ...updates,
      id: model.id, // Prevent ID changes
      path: model.path, // Prevent path changes
    };

    // Save updated metadata
    await this.saveMetadata(updatedModel);

    // Update cache
    this.modelCache.set(id, updatedModel);

    return updatedModel;
  }

  /**
   * Increment generation count for a model
   */
  async recordGeneration(id: string): Promise<void> {
    const model = await this.getModel(id);

    if (!model) {
      throw new Error(`Model not found: ${id}`);
    }

    await this.updateModel(id, {
      generationCount: (model.generationCount || 0) + 1,
      lastUsedAt: new Date(),
    });
  }

  /**
   * Get model statistics
   */
  async getStats(): Promise<ModelStats> {
    const models = await this.listModels();

    if (models.length === 0) {
      return {
        totalModels: 0,
        totalSize: 0,
        baseModelCounts: {},
        averageSize: 0,
      };
    }

    const totalSize = models.reduce((sum, m) => sum + m.size, 0);
    const baseModelCounts: Record<string, number> = {};

    for (const model of models) {
      baseModelCounts[model.baseModel] = (baseModelCounts[model.baseModel] || 0) + 1;
    }

    const dates = models.map((m) => m.createdAt.getTime());

    return {
      totalModels: models.length,
      totalSize,
      baseModelCounts,
      averageSize: totalSize / models.length,
      oldestModel: new Date(Math.min(...dates)),
      newestModel: new Date(Math.max(...dates)),
    };
  }

  /**
   * Verify model integrity (checksum)
   */
  async verifyModel(id: string): Promise<boolean> {
    const model = await this.getModel(id);

    if (!model) {
      throw new Error(`Model not found: ${id}`);
    }

    if (!existsSync(model.path)) {
      return false;
    }

    const currentChecksum = await this.calculateChecksum(model.path);

    return currentChecksum === model.checksum;
  }

  /**
   * Clear model cache
   */
  clearCache(): void {
    this.modelCache.clear();
    this.lastCacheUpdate = 0;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Refresh cache if expired
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    const now = Date.now();

    if (now - this.lastCacheUpdate > this.cacheExpiry) {
      await this.refreshCache();
    }
  }

  /**
   * Refresh model cache from disk
   */
  private async refreshCache(): Promise<void> {
    this.modelCache.clear();

    if (!existsSync(this.config.metadataDir)) {
      this.lastCacheUpdate = Date.now();
      return;
    }

    const files = await readdir(this.config.metadataDir);

    for (const file of files) {
      if (extname(file) === '.json') {
        try {
          const metadataPath = join(this.config.metadataDir, file);
          const content = await readFile(metadataPath, 'utf-8');
          const model = JSON.parse(content) as LoRAModel;

          // Convert date strings to Date objects
          model.createdAt = new Date(model.createdAt);
          if (model.lastUsedAt) model.lastUsedAt = new Date(model.lastUsedAt);
          if (model.trainingResult.completedAt) {
            model.trainingResult.completedAt = new Date(model.trainingResult.completedAt);
          }

          this.modelCache.set(model.id, model);
        } catch (error) {
          console.error(`Failed to load model metadata from ${file}:`, error);
        }
      }
    }

    this.lastCacheUpdate = Date.now();
  }

  /**
   * Apply filters to model list
   */
  private applyFilters(models: LoRAModel[], filter: ModelFilter): LoRAModel[] {
    let filtered = models;

    if (filter.baseModel) {
      filtered = filtered.filter((m) => m.baseModel === filter.baseModel);
    }

    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter((m) => filter.tags!.some((tag) => m.tags?.includes(tag)));
    }

    if (filter.namePattern) {
      const pattern = new RegExp(filter.namePattern, 'i');
      filtered = filtered.filter((m) => pattern.test(m.name));
    }

    if (filter.createdAfter) {
      filtered = filtered.filter((m) => m.createdAt >= filter.createdAfter!);
    }

    if (filter.createdBefore) {
      filtered = filtered.filter((m) => m.createdAt <= filter.createdBefore!);
    }

    if (filter.minSize !== undefined) {
      filtered = filtered.filter((m) => m.size >= filter.minSize!);
    }

    if (filter.maxSize !== undefined) {
      filtered = filtered.filter((m) => m.size <= filter.maxSize!);
    }

    return filtered;
  }

  /**
   * Save model metadata to disk
   */
  private async saveMetadata(model: LoRAModel): Promise<void> {
    await this.ensureDirectories();

    const metadataPath = join(this.config.metadataDir, `${model.id}.json`);
    await writeFile(metadataPath, JSON.stringify(model, null, 2), 'utf-8');
  }

  /**
   * Delete model metadata from disk
   */
  private async deleteMetadata(id: string): Promise<void> {
    const metadataPath = join(this.config.metadataDir, `${id}.json`);

    if (existsSync(metadataPath)) {
      await unlink(metadataPath);
    }
  }

  /**
   * Calculate SHA256 checksum of a file
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    if (!existsSync(this.config.lorasDir)) {
      await mkdir(this.config.lorasDir, { recursive: true });
    }

    if (!existsSync(this.config.metadataDir)) {
      await mkdir(this.config.metadataDir, { recursive: true });
    }
  }
}
