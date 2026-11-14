/**
 * Recovered public package surface for the core CLI/runtime workflow.
 */

export {
  GameContentGenerator,
  GenerationEvents,
  ImageContentGenerator,
  TextContentGenerator,
  AudioContentGenerator
} from './generators';
export type {
  GameGenerationRequest,
  GeneratedGamePackage,
  ImageGenerationSpec,
  TextGenerationSpec,
  AudioGenerationSpec
} from './generators/types';

export {
  ProviderFactory,
  FactoryConfigSchema,
  ImageProviderBase,
  TextProviderBase,
  AudioProviderBase,
  ImageRequestSchema,
  TextRequestSchema,
  AudioRequestSchema,
  SupportedLanguages
} from './providers';
export type {
  FactoryConfig,
  ProviderType,
  ImageRequest,
  ImageData,
  TextRequest,
  TextData,
  AudioRequest,
  AudioData
} from './providers';

export { PromptBuilder, buildPrompt } from './training/PromptBuilder';
export { QualityValidator } from './training/QualityValidator';
