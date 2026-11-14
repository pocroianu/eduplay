/**
 * Training Configuration Presets and Validation
 *
 * Provides pre-configured training setups and Zod validation schemas
 * for Phase 4: LoRA Training
 */

import { z } from 'zod';
import type {
  LoRATrainingConfig,
  TrainingPreset,
  BaseModel,
  OptimizerType,
  LRSchedulerType,
  MixedPrecision,
} from './types';

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Base model schema
 */
export const BaseModelSchema = z.enum(['sdxl-1.0', 'sd-1.5', 'sdxl-turbo']);

/**
 * Optimizer schema
 */
export const OptimizerSchema = z.enum(['AdamW', 'AdamW8bit', 'Adafactor', 'Lion']);

/**
 * Learning rate scheduler schema
 */
export const LRSchedulerSchema = z.enum([
  'linear',
  'cosine',
  'cosine_with_restarts',
  'polynomial',
  'constant',
  'constant_with_warmup',
]);

/**
 * Mixed precision schema
 */
export const MixedPrecisionSchema = z.enum(['no', 'fp16', 'bf16']);

/**
 * LoRA training configuration schema
 */
export const LoRATrainingConfigSchema = z.object({
  // Job identification
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Name must contain only alphanumeric characters, hyphens, and underscores'),

  description: z.string().max(500).optional(),

  // Dataset
  datasetPath: z.string().min(1, 'Dataset path is required'),

  // Model configuration
  baseModel: BaseModelSchema,
  resolution: z.union([z.literal(512), z.literal(1024)], {
    errorMap: () => ({ message: 'Resolution must be 512 or 1024' }),
  }),

  // Training hyperparameters
  epochs: z.number().int().min(1).max(1000),
  batchSize: z.number().int().min(1).max(128),
  learningRate: z.number().min(1e-7).max(1e-2),
  loraRank: z.number().int().min(1).max(128),
  loraAlpha: z.number().int().min(1).max(256),

  // Optimizer settings
  optimizer: OptimizerSchema,
  lrScheduler: LRSchedulerSchema,
  lrWarmupSteps: z.number().int().min(0).optional(),

  // Advanced training options
  mixedPrecision: MixedPrecisionSchema,
  gradientAccumulationSteps: z.number().int().min(1).max(32).optional(),
  maxGradNorm: z.number().min(0).max(10).optional(),
  minSNRGamma: z.number().min(0).max(20).optional(),
  noiseOffset: z.number().min(0).max(1).optional(),

  // Checkpointing
  saveEveryNEpochs: z.number().int().min(1).max(100),
  keepNCheckpoints: z.number().int().min(1).max(50),

  // Validation
  validationEpochs: z.array(z.number().int().min(1)),
  validationPrompts: z.array(z.string()).optional(),

  // Output
  outputDir: z.string().optional(),

  // Advanced options
  seed: z.number().int().min(0).optional(),
  enableXformers: z.boolean().optional(),
  enableCPUOffload: z.boolean().optional(),
  cacheLatents: z.boolean().optional(),
});

/**
 * Validate LoRA training configuration
 */
export function validateTrainingConfig(config: unknown): {
  success: boolean;
  data?: LoRATrainingConfig;
  errors?: z.ZodError;
} {
  const result = LoRATrainingConfigSchema.safeParse(config);

  if (result.success) {
    return {
      success: true,
      data: result.data as LoRATrainingConfig,
    };
  }

  return {
    success: false,
    errors: result.error,
  };
}

// ============================================================================
// Training Presets
// ============================================================================

/**
 * Children's Book Style Preset
 *
 * Optimized for generating simple, vibrant illustrations with clean
 * backgrounds and bold colors suitable for early learning content.
 *
 * Best for: Educational games, storybooks, flashcards
 * Training time: 2-4 hours (RTX 4080 Super)
 * GPU memory: 12-16GB
 * Model size: 300-500MB
 */
export const CHILDREN_BOOK_PRESET: TrainingPreset = {
  id: 'children-book',
  name: "Children's Book Style",
  description: 'Simple, vibrant illustrations with clean backgrounds and bold colors',
  bestFor: ['Educational games', 'Storybooks', 'Flashcards', 'Learning materials'],
  config: {
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
    enableXformers: true,
    cacheLatents: true,
    validationPrompts: [
      'A cute cartoon apple, bright colors, simple shapes, clean white background',
      'A friendly cartoon dog, children book illustration, soft pastel colors',
      'A smiling cartoon sun, bright yellow, simple design for kids',
    ],
  },
  expectedTrainingTime: '2-4 hours',
  expectedGPUMemory: '12-16GB',
  expectedModelSize: '300-500MB',
};

/**
 * Realistic Photo Preset
 *
 * Balanced preset for photorealistic images with moderate detail.
 * Good for educational content requiring real-world accuracy.
 *
 * Best for: Science education, geography, real-world objects
 * Training time: 3-5 hours (RTX 4080 Super)
 * GPU memory: 14-18GB
 * Model size: 400-600MB
 */
export const REALISTIC_PRESET: TrainingPreset = {
  id: 'realistic',
  name: 'Realistic Photo Style',
  description: 'Photorealistic images with moderate detail for educational content',
  bestFor: ['Science education', 'Geography', 'Real-world objects', 'Nature photography'],
  config: {
    baseModel: 'sdxl-1.0',
    resolution: 1024,
    epochs: 80,
    batchSize: 2,
    learningRate: 5e-5,
    loraRank: 32,
    loraAlpha: 64,
    optimizer: 'AdamW8bit',
    lrScheduler: 'cosine',
    lrWarmupSteps: 200,
    mixedPrecision: 'fp16',
    minSNRGamma: 5,
    noiseOffset: 0.05,
    saveEveryNEpochs: 10,
    keepNCheckpoints: 4,
    validationEpochs: [20, 40, 60, 80],
    enableXformers: true,
    cacheLatents: true,
    validationPrompts: [
      'A red apple on a wooden table, natural lighting, photorealistic',
      'A golden retriever in a park, professional photo, sharp details',
      'A colorful butterfly on a flower, macro photography, realistic',
    ],
  },
  expectedTrainingTime: '3-5 hours',
  expectedGPUMemory: '14-18GB',
  expectedModelSize: '400-600MB',
};

/**
 * Fast Iteration Preset
 *
 * Quick training for rapid prototyping and testing. Lower quality
 * but much faster iteration cycles.
 *
 * Best for: Testing datasets, quick experiments, concept validation
 * Training time: 30-60 minutes (RTX 4080 Super)
 * GPU memory: 8-12GB
 * Model size: 150-250MB
 */
export const FAST_ITERATION_PRESET: TrainingPreset = {
  id: 'fast-iteration',
  name: 'Fast Iteration',
  description: 'Quick training for rapid prototyping and testing',
  bestFor: ['Testing datasets', 'Quick experiments', 'Concept validation', 'Debugging'],
  config: {
    baseModel: 'sdxl-turbo',
    resolution: 512,
    epochs: 20,
    batchSize: 8,
    learningRate: 2e-4,
    loraRank: 8,
    loraAlpha: 16,
    optimizer: 'AdamW8bit',
    lrScheduler: 'constant',
    mixedPrecision: 'fp16',
    saveEveryNEpochs: 5,
    keepNCheckpoints: 2,
    validationEpochs: [10, 20],
    enableXformers: true,
    cacheLatents: true,
    enableCPUOffload: false,
  },
  expectedTrainingTime: '30-60 minutes',
  expectedGPUMemory: '8-12GB',
  expectedModelSize: '150-250MB',
};

/**
 * High Quality Preset
 *
 * Maximum quality training with larger model and longer training.
 * For production-ready models requiring best visual fidelity.
 *
 * Best for: Production assets, high-quality illustrations, final models
 * Training time: 6-10 hours (RTX 4080 Super)
 * GPU memory: 18-24GB
 * Model size: 600-800MB
 */
export const HIGH_QUALITY_PRESET: TrainingPreset = {
  id: 'high-quality',
  name: 'High Quality',
  description: 'Maximum quality training for production-ready models',
  bestFor: ['Production assets', 'High-quality illustrations', 'Final models', 'Commercial use'],
  config: {
    baseModel: 'sdxl-1.0',
    resolution: 1024,
    epochs: 150,
    batchSize: 2,
    learningRate: 3e-5,
    loraRank: 64,
    loraAlpha: 128,
    optimizer: 'AdamW',
    lrScheduler: 'cosine_with_restarts',
    lrWarmupSteps: 300,
    mixedPrecision: 'fp16',
    gradientAccumulationSteps: 2,
    maxGradNorm: 1.0,
    minSNRGamma: 5,
    noiseOffset: 0.05,
    saveEveryNEpochs: 10,
    keepNCheckpoints: 10,
    validationEpochs: [30, 60, 90, 120, 150],
    enableXformers: true,
    cacheLatents: true,
  },
  expectedTrainingTime: '6-10 hours',
  expectedGPUMemory: '18-24GB',
  expectedModelSize: '600-800MB',
};

/**
 * Memory Efficient Preset
 *
 * Optimized for systems with limited VRAM (8-12GB).
 * Uses CPU offloading and smaller batch sizes.
 *
 * Best for: Limited hardware, consumer GPUs, laptop training
 * Training time: 4-6 hours (RTX 3060 12GB)
 * GPU memory: 8-12GB
 * Model size: 200-400MB
 */
export const MEMORY_EFFICIENT_PRESET: TrainingPreset = {
  id: 'memory-efficient',
  name: 'Memory Efficient',
  description: 'Optimized for systems with limited VRAM (8-12GB)',
  bestFor: ['Limited hardware', 'Consumer GPUs', 'Laptop training', 'Budget setups'],
  config: {
    baseModel: 'sd-1.5',
    resolution: 512,
    epochs: 100,
    batchSize: 1,
    learningRate: 1e-4,
    loraRank: 16,
    loraAlpha: 32,
    optimizer: 'AdamW8bit',
    lrScheduler: 'cosine',
    lrWarmupSteps: 100,
    mixedPrecision: 'fp16',
    gradientAccumulationSteps: 4,
    saveEveryNEpochs: 10,
    keepNCheckpoints: 3,
    validationEpochs: [25, 50, 75, 100],
    enableXformers: true,
    enableCPUOffload: true,
    cacheLatents: true,
  },
  expectedTrainingTime: '4-6 hours',
  expectedGPUMemory: '8-12GB',
  expectedModelSize: '200-400MB',
};

/**
 * All available presets
 */
export const TRAINING_PRESETS: Record<string, TrainingPreset> = {
  'children-book': CHILDREN_BOOK_PRESET,
  realistic: REALISTIC_PRESET,
  'fast-iteration': FAST_ITERATION_PRESET,
  'high-quality': HIGH_QUALITY_PRESET,
  'memory-efficient': MEMORY_EFFICIENT_PRESET,
};

/**
 * Get preset by ID
 */
export function getPreset(id: string): TrainingPreset | undefined {
  return TRAINING_PRESETS[id];
}

/**
 * List all available presets
 */
export function listPresets(): TrainingPreset[] {
  return Object.values(TRAINING_PRESETS);
}

/**
 * Apply preset to configuration (merge with user overrides)
 */
export function applyPreset(presetId: string, overrides: Partial<LoRATrainingConfig> = {}): LoRATrainingConfig {
  const preset = getPreset(presetId);

  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }

  // Merge preset config with overrides
  const config = {
    ...preset.config,
    ...overrides,
  } as LoRATrainingConfig;

  // Validate the merged configuration
  const validation = validateTrainingConfig(config);

  if (!validation.success) {
    throw new Error(`Invalid configuration: ${validation.errors?.message}`);
  }

  return validation.data!;
}

/**
 * Create custom configuration with validation
 */
export function createConfig(config: LoRATrainingConfig): LoRATrainingConfig {
  const validation = validateTrainingConfig(config);

  if (!validation.success) {
    throw new Error(`Invalid configuration: ${validation.errors?.message}`);
  }

  return validation.data!;
}

/**
 * Get default configuration (uses children's book preset)
 */
export function getDefaultConfig(): Partial<LoRATrainingConfig> {
  return CHILDREN_BOOK_PRESET.config;
}
