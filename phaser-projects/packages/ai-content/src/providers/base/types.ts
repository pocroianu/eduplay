/**
 * Common types for all providers
 */

/**
 * Generation request metadata
 */
export interface RequestMetadata {
  requestId: string;
  gameId?: string;
  questionId?: string;
  timestamp: Date;
}

/**
 * Generation result wrapper
 */
export interface GenerationResult<T> {
  data: T;
  metadata: RequestMetadata;
  cached: boolean;
  latency: number;
  provider?: string;
  providerDetails?: Record<string, unknown>;
}

/**
 * Batch generation options
 */
export interface BatchOptions {
  concurrency?: number;
  stopOnError?: boolean;
  progressCallback?: (completed: number, total: number) => void;
}
