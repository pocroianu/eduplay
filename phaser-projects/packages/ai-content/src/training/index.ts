/**
 * Training Data Collection Module
 *
 * Public API for Phase 3: Training Data Collection
 */

// Export types
export * from './types';

// Export DataExtractor
export { DataExtractor } from './DataExtractor';

// Export ContentAnalyzer
export { ContentAnalyzer } from './ContentAnalyzer';

// Export PromptTemplates and utilities
export {
  IMAGE_PROMPTS,
  TEXT_PROMPTS,
  AUDIO_PROMPTS,
  NEGATIVE_PROMPTS,
  getPromptsByCategory,
  getPromptById,
  getAllImagePrompts,
  getAllTextPrompts,
  getAllAudioPrompts,
  getAllNegativePrompts,
  getNegativePrompt,
  getTemplateSummary
} from './PromptTemplates';

// Export PromptBuilder
export { PromptBuilder, getPromptBuilder, buildPrompt } from './PromptBuilder';

// Export DatasetBuilder
export { DatasetBuilder } from './DatasetBuilder';

// Export QualityValidator
export { QualityValidator } from './QualityValidator';

// =============================================================================
// Phase 4: LoRA Training Exports
// =============================================================================

// Export TrainingConfig and presets
export {
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
  BaseModelSchema,
  OptimizerSchema,
  LRSchedulerSchema,
  MixedPrecisionSchema,
} from './TrainingConfig';

// Export TrainingProgressTracker
export { TrainingProgressTracker, PROGRESS_EVENTS } from './TrainingProgressTracker';

// Export ModelManager
export { ModelManager } from './ModelManager';
export type { ModelManagerConfig, ModelFilter, ModelStats } from './ModelManager';

// Export LoRATrainer
export { LoRATrainer, TRAINER_EVENTS } from './LoRATrainer';
export type { LoRATrainerConfig } from './LoRATrainer';
