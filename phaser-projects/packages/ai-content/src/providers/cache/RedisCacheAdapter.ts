/**
 * Redis cache adapter for production use
 */

import { createClient, RedisClientType } from 'redis';
import { CacheAdapter, CacheEntry } from './CacheManager';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface RedisCacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  compressionThreshold?: number;
}

/**
 * Redis cache adapter for production deployments.
 *
 * Features:
 * - Automatic TTL management
 * - Compression for large entries
 * - Buffer serialization for images/audio
 * - Graceful connection handling
 */
export class RedisCacheAdapter implements CacheAdapter {
  private client: RedisClientType;
  private config: RedisCacheConfig;
  private connected: boolean = false;

  constructor(config: RedisCacheConfig) {
    this.config = {
      keyPrefix: 'ai-content:',
      compressionThreshold: 10 * 1024,
      ...config
    };

    this.client = createClient({
      socket: {
        host: config.host,
        port: config.port
      },
      password: config.password,
      database: config.db
    });
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
    }
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    await this.ensureConnected();

    const prefixedKey = this.prefixKey(key);
    const raw = await this.client.get(prefixedKey);

    if (!raw) {
      return null;
    }

    try {
      const data = await this.decompress(raw);
      const entry = JSON.parse(data) as CacheEntry<T>;

      // Restore Date objects
      entry.createdAt = new Date(entry.createdAt);
      entry.expiresAt = new Date(entry.expiresAt);

      // Handle Buffer data (images, audio)
      if (entry.metadata.isBuffer && typeof entry.data === 'object' && entry.data !== null) {
        const dataWithBuffer = entry.data as any;
        if (dataWithBuffer.buffer && typeof dataWithBuffer.buffer === 'string') {
          dataWithBuffer.buffer = Buffer.from(dataWithBuffer.buffer, 'base64');
        }
      }

      return entry;
    } catch {
      // Corrupted cache entry
      await this.delete(key);
      return null;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    await this.ensureConnected();

    const prefixedKey = this.prefixKey(key);

    // Clone entry for serialization
    const toStore = { ...entry };

    // Convert Buffer to base64 for JSON serialization
    if (entry.data && typeof entry.data === 'object' && 'buffer' in entry.data) {
      const dataWithBuffer = entry.data as { buffer: Buffer };
      toStore.data = {
        ...entry.data,
        buffer: dataWithBuffer.buffer.toString('base64')
      } as T;
      toStore.metadata = { ...entry.metadata, isBuffer: true };
    }

    const json = JSON.stringify(toStore);
    const compressed = await this.compress(json);

    // Calculate TTL in seconds
    const ttlMs = entry.expiresAt.getTime() - Date.now();
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

    await this.client.setEx(prefixedKey, ttlSeconds, compressed);
  }

  async delete(key: string): Promise<boolean> {
    await this.ensureConnected();
    const prefixedKey = this.prefixKey(key);
    const result = await this.client.del(prefixedKey);
    return result > 0;
  }

  async clear(): Promise<void> {
    await this.ensureConnected();
    const pattern = `${this.config.keyPrefix}*`;

    let cursor = 0;
    do {
      const result = await this.client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;

      if (result.keys.length > 0) {
        await this.client.del(result.keys);
      }
    } while (cursor !== 0);
  }

  async has(key: string): Promise<boolean> {
    await this.ensureConnected();
    const prefixedKey = this.prefixKey(key);
    const exists = await this.client.exists(prefixedKey);
    return exists > 0;
  }

  private prefixKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  private async compress(data: string): Promise<string> {
    if (data.length < (this.config.compressionThreshold || 10240)) {
      return data;
    }

    const compressed = await gzipAsync(Buffer.from(data));
    return 'gzip:' + compressed.toString('base64');
  }

  private async decompress(data: string): Promise<string> {
    if (!data.startsWith('gzip:')) {
      return data;
    }

    const compressed = Buffer.from(data.slice(5), 'base64');
    const decompressed = await gunzipAsync(compressed);
    return decompressed.toString();
  }
}
