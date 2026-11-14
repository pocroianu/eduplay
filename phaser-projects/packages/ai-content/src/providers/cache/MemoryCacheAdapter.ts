/**
 * In-memory cache adapter for testing
 */

import { CacheAdapter, CacheEntry } from './CacheManager';

/**
 * In-memory cache adapter for testing.
 * NOT for production use - no persistence, no size limits.
 *
 * Features:
 * - Simple Map-based storage
 * - Fast for testing
 * - No external dependencies
 */
export class MemoryCacheAdapter implements CacheAdapter {
  private store: Map<string, CacheEntry<unknown>> = new Map();

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.store.get(key);
    return (entry as CacheEntry<T>) || null;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.store.set(key, entry as CacheEntry<unknown>);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  /**
   * Get store size (for testing).
   */
  size(): number {
    return this.store.size;
  }
}
