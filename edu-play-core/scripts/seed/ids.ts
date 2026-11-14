import { createHash } from 'crypto';

/**
 * Build a deterministic RFC-4122-ish UUID from a stable natural key.
 * The version/variant bits are set so Postgres UUID columns accept it.
 */
export function seedUuid(key: string): string {
  const bytes = Buffer.from(createHash('sha256').update(key).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
