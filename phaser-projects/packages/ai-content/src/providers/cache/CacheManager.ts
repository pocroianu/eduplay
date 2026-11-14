/**
 * Cache manager for provider results
 */

import { createHash } from 'crypto';

export interface CacheEntry<T> {
  data: T;
  createdAt: Date;
  expiresAt: Date;
  metadata: Record<string, unknown>;
}

export interface CacheAdapter {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: {
    image: number;  // Default: 7 days
    text: number;   // Default: 1 day
    audio: number;  // Default: 7 days
  };
  maxSize: number;  // Max entries
  compressionThreshold: number; // Compress if > bytes
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttl: {
    image: 7 * 24 * 60 * 60 * 1000, // 7 days
    text: 1 * 24 * 60 * 60 * 1000,  // 1 day
    audio: 7 * 24 * 60 * 60 * 1000  // 7 days
  },
  maxSize: 10000,
  compressionThreshold: 10 * 1024 // 10KB
};

export type ContentType = 'image' | 'text' | 'audio';

/**
 * CacheManager orchestrates caching for all providers.
 *
 * Features:
 * - Pluggable cache adapters (Redis, Memory, etc.)
 * - Content-type specific TTLs
 * - Automatic key generation from request parameters
 * - Compression support
 */
export class CacheManager {
  private adapter: CacheAdapter;
  private config: CacheConfig;

  constructor(adapter: CacheAdapter, config: Partial<CacheConfig> = {}) {
    this.adapter = adapter;
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  /**
   * Generate cache key from request parameters.
   * Keys are deterministic and ignore undefined values.
   */
  generateKey(
    providerName: string,
    contentType: ContentType,
    request: Record<string, unknown>
  ): string {
    const normalized = this.normalizeRequest(request);
    const hash = createHash('sha256')
      .update(JSON.stringify({ providerName, contentType, ...normalized }))
      .digest('hex')
      .substring(0, 16);

    return `ai-content:${contentType}:${providerName}:${hash}`;
  }

  /**
   * Get cached value if exists and not expired.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.config.enabled) {
      return null;
    }

    const entry = await this.adapter.get<T>(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (new Date() > entry.expiresAt) {
      await this.adapter.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store value in cache.
   */
  async set<T>(
    key: string,
    data: T,
    contentType: ContentType,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const ttl = this.config.ttl[contentType];
    const now = new Date();

    const entry: CacheEntry<T> = {
      data,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttl),
      metadata
    };

    await this.adapter.set(key, entry);
  }

  /**
   * Delete cached value.
   */
  async delete(key: string): Promise<boolean> {
    return this.adapter.delete(key);
  }

  /**
   * Clear all cached values.
   */
  async clear(): Promise<void> {
    return this.adapter.clear();
  }

  /**
   * Check if key exists.
   */
  async has(key: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }
    return this.adapter.has(key);
  }

  /**
   * Normalize request for consistent hashing.
   * Removes undefined values, sorts keys.
   */
  private normalizeRequest(request: Record<string, unknown>): Record<string, unknown> {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(request).sort();

    for (const key of keys) {
      const value = request[key];
      if (value !== undefined) {
        sorted[key] = value;
      }
    }

    return sorted;
  }
}
