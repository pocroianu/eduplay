/**
 * Provider module entry point
 *
 * This module provides the core provider infrastructure for AI content generation.
 * It includes:
 * - BaseProvider abstract class for lifecycle management
 * - Provider interfaces for Image, Text, and Audio generation
 * - ProviderFactory for managing provider instances
 * - Caching system with Redis and Memory adapters
 * - Utility functions for retry and timeout handling
 * - Mock providers for testing
 */

// Base infrastructure
export { BaseProvider, ProviderState, ProviderEvents } from './base/BaseProvider';
export type { BaseProviderConfig, HealthCheckResult, ProviderMetrics } from './base/BaseProvider';
export type { RequestMetadata, GenerationResult, BatchOptions } from './base/types';
export {
  ProviderError,
  ProviderUnavailableError,
  ProviderTimeoutError,
  ProviderRateLimitError,
  ProviderValidationError,
  ContentRejectedError,
  ModelNotFoundError
} from './base/errors';

// Provider interfaces
export { ImageProviderBase } from './image/ImageProvider';
export { ImageRequestSchema } from './image/ImageProvider';
export type { ImageRequest, ImageData, IImageProvider } from './image/ImageProvider';
export { ComfyUIProvider } from './image/ComfyUIProvider';
export type { ComfyUIConfig } from './image/ComfyUIProvider';
export { FallbackImageProvider } from './image/FallbackImageProvider';
export { QwenImageProvider, QwenImageConfigSchema } from './image/QwenImageProvider';
export type { QwenImageConfig } from './image/QwenImageProvider';

export { TextProviderBase } from './text/TextProvider';
export { TextRequestSchema } from './text/TextProvider';
export type { TextRequest, TextData, ModelInfo, ITextProvider } from './text/TextProvider';

export { AudioProviderBase } from './audio/AudioProvider';
export { AudioRequestSchema, SupportedLanguages } from './audio/AudioProvider';
export type {
  AudioRequest,
  AudioData,
  Language,
  VoiceInfo,
  IAudioProvider
} from './audio/AudioProvider';

// Factory and configuration
export { ProviderFactory, FactoryConfigSchema } from './factory/ProviderFactory';
export type { FactoryConfig, ProviderType } from './factory/ProviderFactory';

// Cache system
export { CacheManager } from './cache/CacheManager';
export type { CacheEntry, CacheAdapter, CacheConfig, ContentType } from './cache/CacheManager';
export { RedisCacheAdapter } from './cache/RedisCacheAdapter';
export type { RedisCacheConfig } from './cache/RedisCacheAdapter';
export { MemoryCacheAdapter } from './cache/MemoryCacheAdapter';

// Utilities
export { withRetry } from './utils/retry';
export type { RetryOptions } from './utils/retry';
export { withTimeout, createTimeoutController } from './utils/timeout';

// Mock providers for testing
export { MockImageProvider } from './mocks/MockImageProvider';
export { MockTextProvider } from './mocks/MockTextProvider';
export { MockAudioProvider } from './mocks/MockAudioProvider';
