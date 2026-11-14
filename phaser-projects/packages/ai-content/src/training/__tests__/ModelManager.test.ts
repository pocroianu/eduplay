/**
 * ModelManager Unit Tests
 *
 * Tests for LoRA model lifecycle management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModelManager, type ModelFilter, type ModelStats } from '../ModelManager';
import type { LoRAModel, LoRATrainingConfig, TrainingResult } from '../types';
import { readFile, writeFile, readdir, stat, unlink, mkdir, copyFile } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { EventEmitter } from 'events';

// Mock fs modules
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
  mkdir: vi.fn(),
  copyFile: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  createReadStream: vi.fn(),
}));

// =============================================================================
// Test Fixtures
// =============================================================================

const mockConfig: LoRATrainingConfig = {
  name: 'test-model',
  datasetPath: './data.jsonl',
  baseModel: 'sdxl-1.0',
  resolution: 512,
  epochs: 100,
  batchSize: 4,
  learningRate: 1e-4,
  loraRank: 16,
  loraAlpha: 32,
  optimizer: 'AdamW8bit',
  lrScheduler: 'cosine',
  mixedPrecision: 'fp16',
  saveEveryNEpochs: 10,
  keepNCheckpoints: 5,
  validationEpochs: [25, 50, 75, 100],
};

const mockResult: TrainingResult = {
  loraPath: './loras/test-model.safetensors',
  modelSize: 500 * 1024 * 1024,
  finalLoss: 0.25,
  avgLoss: 0.45,
  totalSteps: 1000,
  totalEpochs: 100,
  trainingDuration: 7200,
  avgStepsPerSecond: 2.5,
  checkpoints: ['./loras/test-model-epoch-10.safetensors'],
  completedAt: new Date('2025-01-01T02:00:00Z'),
};

const mockModel: LoRAModel = {
  id: 'test-model-123',
  name: 'test-model',
  version: '1.0.0',
  path: './loras/test-model.safetensors',
  size: 500 * 1024 * 1024,
  checksum: 'abc123',
  baseModel: 'sdxl-1.0',
  trainingConfig: mockConfig,
  trainingResult: mockResult,
  tags: ['test', 'fruits'],
  createdAt: new Date('2025-01-01T00:00:00Z'),
  generationCount: 0,
};

// Mock checksum calculation
const mockChecksum = 'abc123def456';

// =============================================================================
// Helper to mock createReadStream
// =============================================================================

function mockCreateReadStream(data: string) {
  const emitter = new EventEmitter();

  (createReadStream as any).mockReturnValue(emitter);

  // Simulate stream events
  setTimeout(() => {
    emitter.emit('data', Buffer.from(data));
    emitter.emit('end');
  }, 0);

  return emitter;
}

// =============================================================================
// Setup/Teardown
// =============================================================================

describe('ModelManager', () => {
  let manager: ModelManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ModelManager({ lorasDir: './test-loras' });
    (existsSync as any).mockReturnValue(true);
  });

  // ===========================================================================
  // Initialization Tests
  // ===========================================================================

  describe('init', () => {
    it('should create directories if missing', async () => {
      (existsSync as any).mockReturnValue(false);
      (mkdir as any).mockResolvedValue(undefined);

      await manager.init();

      expect(mkdir).toHaveBeenCalledWith('./test-loras', { recursive: true });
      expect(mkdir).toHaveBeenCalledWith('./test-loras/metadata', { recursive: true });
    });

    it('should not create directories if they exist', async () => {
      (existsSync as any).mockReturnValue(true);

      await manager.init();

      expect(mkdir).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // List Models Tests
  // ===========================================================================

  describe('listModels', () => {
    beforeEach(() => {
      (readdir as any).mockResolvedValue(['test-model-123.json']);
      (readFile as any).mockResolvedValue(JSON.stringify(mockModel));
    });

    it('should list all models', async () => {
      const models = await manager.listModels();

      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('test-model');
    });

    it('should filter by base model', async () => {
      const filter: ModelFilter = { baseModel: 'sdxl-1.0' };
      const models = await manager.listModels(filter);

      expect(models).toHaveLength(1);

      const filter2: ModelFilter = { baseModel: 'sd-1.5' };
      const models2 = await manager.listModels(filter2);

      expect(models2).toHaveLength(0);
    });

    it('should filter by tags', async () => {
      const filter: ModelFilter = { tags: ['fruits'] };
      const models = await manager.listModels(filter);

      expect(models).toHaveLength(1);

      const filter2: ModelFilter = { tags: ['animals'] };
      const models2 = await manager.listModels(filter2);

      expect(models2).toHaveLength(0);
    });

    it('should filter by name pattern', async () => {
      const filter: ModelFilter = { namePattern: 'test' };
      const models = await manager.listModels(filter);

      expect(models).toHaveLength(1);

      const filter2: ModelFilter = { namePattern: 'other' };
      const models2 = await manager.listModels(filter2);

      expect(models2).toHaveLength(0);
    });

    it('should filter by creation date', async () => {
      const filter: ModelFilter = {
        createdAfter: new Date('2024-01-01'),
        createdBefore: new Date('2026-01-01'),
      };

      const models = await manager.listModels(filter);

      expect(models).toHaveLength(1);
    });

    it('should filter by size', async () => {
      const filter: ModelFilter = {
        minSize: 100 * 1024 * 1024, // 100 MB
        maxSize: 600 * 1024 * 1024, // 600 MB
      };

      const models = await manager.listModels(filter);

      expect(models).toHaveLength(1);
    });

    it('should return empty array if metadata dir missing', async () => {
      (existsSync as any).mockReturnValue(false);

      const models = await manager.listModels();

      expect(models).toHaveLength(0);
    });

    it('should handle corrupted metadata files', async () => {
      (readdir as any).mockResolvedValue(['test-model-123.json', 'corrupted.json']);
      (readFile as any).mockImplementation((path: string) => {
        if (path.includes('corrupted')) {
          return Promise.resolve('invalid json{');
        }
        return Promise.resolve(JSON.stringify(mockModel));
      });

      const models = await manager.listModels();

      expect(models).toHaveLength(1); // Only valid model loaded
    });
  });

  // ===========================================================================
  // Get Model Tests
  // ===========================================================================

  describe('getModel', () => {
    beforeEach(() => {
      (readdir as any).mockResolvedValue(['test-model-123.json']);
      (readFile as any).mockResolvedValue(JSON.stringify(mockModel));
    });

    it('should get model by ID', async () => {
      const model = await manager.getModel('test-model-123');

      expect(model).toBeDefined();
      expect(model?.name).toBe('test-model');
    });

    it('should return null for unknown ID', async () => {
      const model = await manager.getModel('unknown');

      expect(model).toBeNull();
    });
  });

  describe('getModelByName', () => {
    beforeEach(() => {
      (readdir as any).mockResolvedValue(['test-model-123.json']);
      (readFile as any).mockResolvedValue(JSON.stringify(mockModel));
    });

    it('should get model by name', async () => {
      const model = await manager.getModelByName('test-model');

      expect(model).toBeDefined();
      expect(model?.name).toBe('test-model');
    });

    it('should return null for unknown name', async () => {
      const model = await manager.getModelByName('unknown');

      expect(model).toBeNull();
    });
  });

  // ===========================================================================
  // Save Model Tests
  // ===========================================================================

  describe('saveModel', () => {
    beforeEach(() => {
      (stat as any).mockResolvedValue({ size: 500 * 1024 * 1024 });
      (writeFile as any).mockResolvedValue(undefined);
      (mkdir as any).mockResolvedValue(undefined);
      mockCreateReadStream('model data');
    });

    it('should save model metadata', async () => {
      const model = await manager.saveModel(mockConfig, mockResult, ['test']);

      expect(model).toBeDefined();
      expect(model.name).toBe('test-model');
      expect(model.tags).toContain('test');
      expect(writeFile).toHaveBeenCalled();
    });

    it('should generate unique ID with timestamp', async () => {
      const model1 = await manager.saveModel(mockConfig, mockResult);

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const model2 = await manager.saveModel(mockConfig, mockResult);

      expect(model1.id).not.toBe(model2.id);
      expect(model1.id).toContain('test-model');
      expect(model2.id).toContain('test-model');
    });

    it('should calculate checksum', async () => {
      const model = await manager.saveModel(mockConfig, mockResult);

      expect(model.checksum).toBeDefined();
      expect(model.checksum.length).toBe(64); // SHA256 hex length
    });
  });

  // ===========================================================================
  // Export Model Tests
  // ===========================================================================

  describe('exportModel', () => {
    beforeEach(async () => {
      (readdir as any).mockResolvedValue(['test-model-123.json']);
      (readFile as any).mockResolvedValue(JSON.stringify(mockModel));
      (copyFile as any).mockResolvedValue(undefined);
      (mkdir as any).mockResolvedValue(undefined);
      (existsSync as any).mockReturnValue(true);
    });

    it('should export model file', async () => {
      const exportPath = await manager.exportModel('test-model-123', './exports');

      expect(copyFile).toHaveBeenCalledWith(
        './loras/test-model.safetensors',
        expect.stringContaining('exports')
      );
      expect(exportPath).toContain('test-model.safetensors');
    });

    it('should export metadata by default', async () => {
      await manager.exportModel('test-model-123', './exports');

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('metadata.json'),
        expect.any(String),
        'utf-8'
      );
    });

    it('should not export metadata if disabled', async () => {
      await manager.exportModel('test-model-123', './exports', { includeMetadata: false });

      expect(writeFile).not.toHaveBeenCalled();
    });

    it('should export checkpoints if requested', async () => {
      await manager.exportModel('test-model-123', './exports', { includeCheckpoints: true });

      expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('checkpoints'), { recursive: true });
      expect(copyFile).toHaveBeenCalledWith(
        './loras/test-model-epoch-10.safetensors',
        expect.stringContaining('checkpoints')
      );
    });

    it('should throw if model not found', async () => {
      await expect(manager.exportModel('unknown', './exports')).rejects.toThrow('Model not found');
    });
  });

  // ===========================================================================
  // Delete Model Tests
  // ===========================================================================

  describe('deleteModel', () => {
    beforeEach(async () => {
      (readdir as any).mockResolvedValue(['test-model-123.json']);
      (readFile as any).mockResolvedValue(JSON.stringify(mockModel));
      (unlink as any).mockResolvedValue(undefined);
      (existsSync as any).mockReturnValue(true);
    });

    it('should delete model file', async () => {
      await manager.deleteModel('test-model-123');

      expect(unlink).toHaveBeenCalledWith('./loras/test-model.safetensors');
    });

    it('should delete metadata', async () => {
      await manager.deleteModel('test-model-123');

      expect(unlink).toHaveBeenCalledWith(expect.stringContaining('test-model-123.json'));
    });

    it('should delete checkpoints by default', async () => {
      await manager.deleteModel('test-model-123');

      expect(unlink).toHaveBeenCalledWith('./loras/test-model-epoch-10.safetensors');
    });

    it('should not delete checkpoints if disabled', async () => {
      await manager.deleteModel('test-model-123', false);

      expect(unlink).not.toHaveBeenCalledWith('./loras/test-model-epoch-10.safetensors');
    });

    it('should remove from cache', async () => {
      await manager.deleteModel('test-model-123');

      const model = await manager.getModel('test-model-123');
      expect(model).toBeNull();
    });

    it('should throw if model not found', async () => {
      await expect(manager.deleteModel('unknown')).rejects.toThrow('Model not found');
    });
  });

  // ===========================================================================
  // Update Model Tests
  // ===========================================================================

  describe('updateModel', () => {
    beforeEach(async () => {
      (readdir as any).mockResolvedValue(['test-model-123.json']);
      (readFile as any).mockResolvedValue(JSON.stringify(mockModel));
      (writeFile as any).mockResolvedValue(undefined);
    });

    it('should update model metadata', async () => {
      const updated = await manager.updateModel('test-model-123', {
        description: 'Updated description',
        tags: ['updated'],
      });

      expect(updated.description).toBe('Updated description');
      expect(updated.tags).toContain('updated');
      expect(writeFile).toHaveBeenCalled();
    });

    it('should not allow ID changes', async () => {
      const updated = await manager.updateModel('test-model-123', {
        id: 'different-id',
      } as any);

      expect(updated.id).toBe('test-model-123');
    });

    it('should not allow path changes', async () => {
      const updated = await manager.updateModel('test-model-123', {
        path: '/different/path',
      } as any);

      expect(updated.path).toBe('./loras/test-model.safetensors');
    });

    it('should throw if model not found', async () => {
      await expect(manager.updateModel('unknown', {})).rejects.toThrow('Model not found');
    });
  });

  describe('recordGeneration', () => {
    beforeEach(async () => {
      (readdir as any).mockResolvedValue(['test-model-123.json']);
      (readFile as any).mockResolvedValue(JSON.stringify(mockModel));
      (writeFile as any).mockResolvedValue(undefined);
    });

    it('should increment generation count', async () => {
      await manager.recordGeneration('test-model-123');

      const model = await manager.getModel('test-model-123');
      expect(model?.generationCount).toBe(1);
    });

    it('should update lastUsedAt', async () => {
      await manager.recordGeneration('test-model-123');

      const model = await manager.getModel('test-model-123');
      expect(model?.lastUsedAt).toBeDefined();
    });

    it('should throw if model not found', async () => {
      await expect(manager.recordGeneration('unknown')).rejects.toThrow('Model not found');
    });
  });

  // ===========================================================================
  // Statistics Tests
  // ===========================================================================

  describe('getStats', () => {
    it('should return stats for models', async () => {
      const model1 = { ...mockModel, id: 'model-1', baseModel: 'sdxl-1.0' as const };
      const model2 = { ...mockModel, id: 'model-2', baseModel: 'sd-1.5' as const };

      (readdir as any).mockResolvedValue(['model-1.json', 'model-2.json']);
      (readFile as any).mockImplementation((path: string) => {
        if (path.includes('model-1')) {
          return Promise.resolve(JSON.stringify(model1));
        }
        return Promise.resolve(JSON.stringify(model2));
      });

      const stats = await manager.getStats();

      expect(stats.totalModels).toBe(2);
      expect(stats.totalSize).toBe(1000 * 1024 * 1024); // 1000 MB
      expect(stats.averageSize).toBe(500 * 1024 * 1024);
      expect(stats.baseModelCounts['sdxl-1.0']).toBe(1);
      expect(stats.baseModelCounts['sd-1.5']).toBe(1);
    });

    it('should return empty stats if no models', async () => {
      (existsSync as any).mockReturnValue(false);

      const stats = await manager.getStats();

      expect(stats.totalModels).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageSize).toBe(0);
    });
  });

  // ===========================================================================
  // Verification Tests
  // ===========================================================================

  describe('verifyModel', () => {
    beforeEach(async () => {
      (readdir as any).mockResolvedValue(['test-model-123.json']);
      (readFile as any).mockResolvedValue(JSON.stringify({
        ...mockModel,
        checksum: mockChecksum,
      }));
      (existsSync as any).mockReturnValue(true);
    });

    it('should verify model checksum', async () => {
      mockCreateReadStream('model data');

      const isValid = await manager.verifyModel('test-model-123');

      expect(isValid).toBe(true);
    });

    it('should return false if file missing', async () => {
      (existsSync as any).mockReturnValue(false);

      const isValid = await manager.verifyModel('test-model-123');

      expect(isValid).toBe(false);
    });

    it('should throw if model not found', async () => {
      await expect(manager.verifyModel('unknown')).rejects.toThrow('Model not found');
    });
  });

  // ===========================================================================
  // Cache Tests
  // ===========================================================================

  describe('clearCache', () => {
    beforeEach(async () => {
      (readdir as any).mockResolvedValue(['test-model-123.json']);
      (readFile as any).mockResolvedValue(JSON.stringify(mockModel));
    });

    it('should clear model cache', async () => {
      // Load models
      await manager.listModels();

      // Clear cache
      manager.clearCache();

      // Force cache refresh by setting readdir to return empty
      (readdir as any).mockResolvedValue([]);

      const models = await manager.listModels();
      expect(models).toHaveLength(0);
    });
  });
});
