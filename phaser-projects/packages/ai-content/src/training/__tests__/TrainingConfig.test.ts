/**
 * TrainingConfig Unit Tests
 *
 * Tests for training configuration presets and validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateTrainingConfig,
  getPreset,
  listPresets,
  applyPreset,
  createConfig,
  getDefaultConfig,
  CHILDREN_BOOK_PRESET,
  REALISTIC_PRESET,
  FAST_ITERATION_PRESET,
  HIGH_QUALITY_PRESET,
  MEMORY_EFFICIENT_PRESET,
  TRAINING_PRESETS,
  LoRATrainingConfigSchema,
} from '../TrainingConfig';
import type { LoRATrainingConfig } from '../types';

// =============================================================================
// Test Fixtures
// =============================================================================

const validConfig: LoRATrainingConfig = {
  name: 'test-model',
  description: 'Test model description',
  datasetPath: './datasets/test.jsonl',
  baseModel: 'sdxl-1.0',
  resolution: 512,
  epochs: 100,
  batchSize: 4,
  learningRate: 1e-4,
  loraRank: 16,
  loraAlpha: 32,
  optimizer: 'AdamW8bit',
  lrScheduler: 'cosine',
  lrWarmupSteps: 100,
  mixedPrecision: 'fp16',
  minSNRGamma: 5,
  noiseOffset: 0.03,
  saveEveryNEpochs: 10,
  keepNCheckpoints: 5,
  validationEpochs: [25, 50, 75, 100],
  validationPrompts: ['A cute cartoon apple'],
  outputDir: './loras',
  seed: 42,
  enableXformers: true,
  cacheLatents: true,
};

// =============================================================================
// Validation Tests
// =============================================================================

describe('TrainingConfig - Validation', () => {
  describe('validateTrainingConfig', () => {
    it('should validate a correct configuration', () => {
      const result = validateTrainingConfig(validConfig);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should reject missing required fields', () => {
      const invalidConfig = {
        name: 'test',
        // Missing datasetPath
        baseModel: 'sdxl-1.0',
      };

      const result = validateTrainingConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject invalid name characters', () => {
      const invalidConfig = {
        ...validConfig,
        name: 'invalid name!@#',
      };

      const result = validateTrainingConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject name that is too long', () => {
      const invalidConfig = {
        ...validConfig,
        name: 'a'.repeat(101),
      };

      const result = validateTrainingConfig(invalidConfig);

      expect(result.success).toBe(false);
    });

    it('should reject invalid base model', () => {
      const invalidConfig = {
        ...validConfig,
        baseModel: 'invalid-model',
      };

      const result = validateTrainingConfig(invalidConfig);

      expect(result.success).toBe(false);
    });

    it('should reject invalid resolution', () => {
      const invalidConfig = {
        ...validConfig,
        resolution: 768, // Only 512 or 1024 allowed
      };

      const result = validateTrainingConfig(invalidConfig);

      expect(result.success).toBe(false);
    });

    it('should reject epochs out of range', () => {
      const tooLow = { ...validConfig, epochs: 0 };
      const tooHigh = { ...validConfig, epochs: 1001 };

      expect(validateTrainingConfig(tooLow).success).toBe(false);
      expect(validateTrainingConfig(tooHigh).success).toBe(false);
    });

    it('should reject batch size out of range', () => {
      const tooLow = { ...validConfig, batchSize: 0 };
      const tooHigh = { ...validConfig, batchSize: 129 };

      expect(validateTrainingConfig(tooLow).success).toBe(false);
      expect(validateTrainingConfig(tooHigh).success).toBe(false);
    });

    it('should reject learning rate out of range', () => {
      const tooLow = { ...validConfig, learningRate: 1e-8 };
      const tooHigh = { ...validConfig, learningRate: 0.02 };

      expect(validateTrainingConfig(tooLow).success).toBe(false);
      expect(validateTrainingConfig(tooHigh).success).toBe(false);
    });

    it('should reject LoRA rank out of range', () => {
      const tooLow = { ...validConfig, loraRank: 0 };
      const tooHigh = { ...validConfig, loraRank: 129 };

      expect(validateTrainingConfig(tooLow).success).toBe(false);
      expect(validateTrainingConfig(tooHigh).success).toBe(false);
    });

    it('should reject invalid optimizer', () => {
      const invalidConfig = {
        ...validConfig,
        optimizer: 'SGD',
      };

      const result = validateTrainingConfig(invalidConfig);

      expect(result.success).toBe(false);
    });

    it('should reject invalid lr scheduler', () => {
      const invalidConfig = {
        ...validConfig,
        lrScheduler: 'exponential',
      };

      const result = validateTrainingConfig(invalidConfig);

      expect(result.success).toBe(false);
    });

    it('should reject invalid mixed precision', () => {
      const invalidConfig = {
        ...validConfig,
        mixedPrecision: 'fp32',
      };

      const result = validateTrainingConfig(invalidConfig);

      expect(result.success).toBe(false);
    });

    it('should accept all valid base models', () => {
      const models: Array<'sdxl-1.0' | 'sd-1.5' | 'sdxl-turbo'> = ['sdxl-1.0', 'sd-1.5', 'sdxl-turbo'];

      models.forEach((model) => {
        const config = { ...validConfig, baseModel: model };
        const result = validateTrainingConfig(config);
        expect(result.success).toBe(true);
      });
    });

    it('should accept all valid optimizers', () => {
      const optimizers: Array<'AdamW' | 'AdamW8bit' | 'Adafactor' | 'Lion'> = [
        'AdamW',
        'AdamW8bit',
        'Adafactor',
        'Lion',
      ];

      optimizers.forEach((optimizer) => {
        const config = { ...validConfig, optimizer };
        const result = validateTrainingConfig(config);
        expect(result.success).toBe(true);
      });
    });

    it('should accept optional fields as undefined', () => {
      const minimalConfig = {
        name: 'test',
        datasetPath: './data.jsonl',
        baseModel: 'sdxl-1.0',
        resolution: 512,
        epochs: 50,
        batchSize: 4,
        learningRate: 1e-4,
        loraRank: 16,
        loraAlpha: 32,
        optimizer: 'AdamW8bit',
        lrScheduler: 'cosine',
        mixedPrecision: 'fp16',
        saveEveryNEpochs: 10,
        keepNCheckpoints: 3,
        validationEpochs: [50],
      };

      const result = validateTrainingConfig(minimalConfig);

      expect(result.success).toBe(true);
      expect(result.data?.description).toBeUndefined();
      expect(result.data?.lrWarmupSteps).toBeUndefined();
      expect(result.data?.validationPrompts).toBeUndefined();
    });
  });

  describe('createConfig', () => {
    it('should create valid config', () => {
      const config = createConfig(validConfig);

      expect(config).toBeDefined();
      expect(config.name).toBe(validConfig.name);
    });

    it('should throw on invalid config', () => {
      const invalidConfig = {
        ...validConfig,
        epochs: -1,
      } as LoRATrainingConfig;

      expect(() => createConfig(invalidConfig)).toThrow('Invalid configuration');
    });
  });
});

// =============================================================================
// Preset Tests
// =============================================================================

describe('TrainingConfig - Presets', () => {
  describe('getPreset', () => {
    it('should return children-book preset', () => {
      const preset = getPreset('children-book');

      expect(preset).toBeDefined();
      expect(preset?.id).toBe('children-book');
      expect(preset?.config.baseModel).toBe('sdxl-1.0');
      expect(preset?.config.resolution).toBe(512);
    });

    it('should return realistic preset', () => {
      const preset = getPreset('realistic');

      expect(preset).toBeDefined();
      expect(preset?.id).toBe('realistic');
      expect(preset?.config.resolution).toBe(1024);
    });

    it('should return fast-iteration preset', () => {
      const preset = getPreset('fast-iteration');

      expect(preset).toBeDefined();
      expect(preset?.id).toBe('fast-iteration');
      expect(preset?.config.epochs).toBe(20);
    });

    it('should return high-quality preset', () => {
      const preset = getPreset('high-quality');

      expect(preset).toBeDefined();
      expect(preset?.id).toBe('high-quality');
      expect(preset?.config.loraRank).toBe(64);
    });

    it('should return memory-efficient preset', () => {
      const preset = getPreset('memory-efficient');

      expect(preset).toBeDefined();
      expect(preset?.id).toBe('memory-efficient');
      expect(preset?.config.enableCPUOffload).toBe(true);
    });

    it('should return undefined for unknown preset', () => {
      const preset = getPreset('unknown-preset');

      expect(preset).toBeUndefined();
    });
  });

  describe('listPresets', () => {
    it('should return all presets', () => {
      const presets = listPresets();

      expect(presets).toHaveLength(5);
      expect(presets.map((p) => p.id)).toContain('children-book');
      expect(presets.map((p) => p.id)).toContain('realistic');
      expect(presets.map((p) => p.id)).toContain('fast-iteration');
      expect(presets.map((p) => p.id)).toContain('high-quality');
      expect(presets.map((p) => p.id)).toContain('memory-efficient');
    });

    it('should return presets with all required fields', () => {
      const presets = listPresets();

      presets.forEach((preset) => {
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(preset.bestFor).toBeInstanceOf(Array);
        expect(preset.config).toBeDefined();
      });
    });
  });

  describe('applyPreset', () => {
    it('should apply preset without overrides', () => {
      const config = applyPreset('children-book', {
        name: 'my-model',
        datasetPath: './data.jsonl',
      });

      expect(config.name).toBe('my-model');
      expect(config.datasetPath).toBe('./data.jsonl');
      expect(config.baseModel).toBe('sdxl-1.0');
      expect(config.resolution).toBe(512);
      expect(config.epochs).toBe(100);
    });

    it('should apply preset with overrides', () => {
      const config = applyPreset('children-book', {
        name: 'my-model',
        datasetPath: './data.jsonl',
        epochs: 50,
        batchSize: 8,
      });

      expect(config.name).toBe('my-model');
      expect(config.epochs).toBe(50); // Override
      expect(config.batchSize).toBe(8); // Override
      expect(config.baseModel).toBe('sdxl-1.0'); // From preset
    });

    it('should throw on unknown preset', () => {
      expect(() =>
        applyPreset('unknown', {
          name: 'test',
          datasetPath: './data.jsonl',
        }),
      ).toThrow('Unknown preset');
    });

    it('should throw on invalid config after merge', () => {
      expect(() =>
        applyPreset('children-book', {
          name: 'test',
          datasetPath: './data.jsonl',
          epochs: -1, // Invalid
        }),
      ).toThrow('Invalid configuration');
    });
  });

  describe('getDefaultConfig', () => {
    it('should return children-book preset config', () => {
      const config = getDefaultConfig();

      expect(config.baseModel).toBe('sdxl-1.0');
      expect(config.resolution).toBe(512);
      expect(config.epochs).toBe(100);
    });
  });
});

// =============================================================================
// Preset Configuration Tests
// =============================================================================

describe('TrainingConfig - Preset Configurations', () => {
  describe('CHILDREN_BOOK_PRESET', () => {
    it('should have valid configuration', () => {
      const config = {
        ...CHILDREN_BOOK_PRESET.config,
        name: 'test',
        datasetPath: './data.jsonl',
      };

      const result = validateTrainingConfig(config);

      expect(result.success).toBe(true);
    });

    it('should have appropriate settings for children content', () => {
      const config = CHILDREN_BOOK_PRESET.config;

      expect(config.resolution).toBe(512); // Lower res for simple art
      expect(config.loraRank).toBe(16); // Moderate rank
      expect(config.minSNRGamma).toBe(5); // Noise reduction
      expect(config.enableXformers).toBe(true); // Memory optimization
    });

    it('should have validation prompts', () => {
      const config = CHILDREN_BOOK_PRESET.config;

      expect(config.validationPrompts).toBeDefined();
      expect(config.validationPrompts!.length).toBeGreaterThan(0);
    });
  });

  describe('REALISTIC_PRESET', () => {
    it('should have valid configuration', () => {
      const config = {
        ...REALISTIC_PRESET.config,
        name: 'test',
        datasetPath: './data.jsonl',
      };

      const result = validateTrainingConfig(config);

      expect(result.success).toBe(true);
    });

    it('should have appropriate settings for realistic images', () => {
      const config = REALISTIC_PRESET.config;

      expect(config.resolution).toBe(1024); // Higher res for detail
      expect(config.loraRank).toBe(32); // Higher rank
      expect(config.batchSize).toBe(2); // Smaller batch for higher res
    });
  });

  describe('FAST_ITERATION_PRESET', () => {
    it('should have valid configuration', () => {
      const config = {
        ...FAST_ITERATION_PRESET.config,
        name: 'test',
        datasetPath: './data.jsonl',
      };

      const result = validateTrainingConfig(config);

      expect(result.success).toBe(true);
    });

    it('should have appropriate settings for fast training', () => {
      const config = FAST_ITERATION_PRESET.config;

      expect(config.epochs).toBeLessThanOrEqual(20); // Quick
      expect(config.loraRank).toBeLessThanOrEqual(8); // Small model
      expect(config.batchSize).toBeGreaterThanOrEqual(8); // Larger batches
    });
  });

  describe('HIGH_QUALITY_PRESET', () => {
    it('should have valid configuration', () => {
      const config = {
        ...HIGH_QUALITY_PRESET.config,
        name: 'test',
        datasetPath: './data.jsonl',
      };

      const result = validateTrainingConfig(config);

      expect(result.success).toBe(true);
    });

    it('should have appropriate settings for high quality', () => {
      const config = HIGH_QUALITY_PRESET.config;

      expect(config.epochs).toBeGreaterThanOrEqual(100); // Long training
      expect(config.loraRank).toBeGreaterThanOrEqual(64); // Large model
      expect(config.resolution).toBe(1024); // High resolution
    });
  });

  describe('MEMORY_EFFICIENT_PRESET', () => {
    it('should have valid configuration', () => {
      const config = {
        ...MEMORY_EFFICIENT_PRESET.config,
        name: 'test',
        datasetPath: './data.jsonl',
      };

      const result = validateTrainingConfig(config);

      expect(result.success).toBe(true);
    });

    it('should have appropriate settings for limited VRAM', () => {
      const config = MEMORY_EFFICIENT_PRESET.config;

      expect(config.batchSize).toBe(1); // Minimal batch
      expect(config.enableCPUOffload).toBe(true); // CPU offload
      expect(config.gradientAccumulationSteps).toBeGreaterThan(1); // Compensate for small batch
    });
  });
});

// =============================================================================
// Schema Tests
// =============================================================================

describe('TrainingConfig - Schemas', () => {
  it('should export all schemas', () => {
    expect(LoRATrainingConfigSchema).toBeDefined();
  });

  it('should validate with Zod directly', () => {
    const result = LoRATrainingConfigSchema.safeParse(validConfig);

    expect(result.success).toBe(true);
  });

  it('should provide detailed error messages', () => {
    const invalidConfig = {
      name: '', // Empty name
      datasetPath: './data.jsonl',
      baseModel: 'invalid',
    };

    const result = LoRATrainingConfigSchema.safeParse(invalidConfig);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// TRAINING_PRESETS Object Tests
// =============================================================================

describe('TrainingConfig - TRAINING_PRESETS', () => {
  it('should contain all preset IDs as keys', () => {
    const keys = Object.keys(TRAINING_PRESETS);

    expect(keys).toContain('children-book');
    expect(keys).toContain('realistic');
    expect(keys).toContain('fast-iteration');
    expect(keys).toContain('high-quality');
    expect(keys).toContain('memory-efficient');
  });

  it('should have preset IDs matching their keys', () => {
    Object.entries(TRAINING_PRESETS).forEach(([key, preset]) => {
      expect(preset.id).toBe(key);
    });
  });

  it('should have all presets with expected metadata', () => {
    Object.values(TRAINING_PRESETS).forEach((preset) => {
      expect(preset.expectedTrainingTime).toBeDefined();
      expect(preset.expectedGPUMemory).toBeDefined();
      expect(preset.expectedModelSize).toBeDefined();
    });
  });
});
