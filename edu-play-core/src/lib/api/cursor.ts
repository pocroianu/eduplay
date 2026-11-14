/**
 * Base64-encoded cursor over `(created_at, id)` tuples for stable
 * keyset-paginated lists where rows are ordered by `created_at DESC`.
 *
 * The encoded form is a URL-safe base64 of `${iso8601}|${id}`.
 */
export interface KeysetCursor {
  createdAt: string;
  id: string;
}

export function encodeCursor(cursor: KeysetCursor): string {
  const raw = `${cursor.createdAt}|${cursor.id}`;
  return Buffer.from(raw, 'utf8').toString('base64url');
}

export function decodeCursor(value: string): KeysetCursor | null {
  try {
    const raw = Buffer.from(value, 'base64url').toString('utf8');
    const sep = raw.indexOf('|');
    if (sep < 0) return null;
    const createdAt = raw.slice(0, sep);
    const id = raw.slice(sep + 1);
    if (!createdAt || !id) return null;
    if (Number.isNaN(Date.parse(createdAt))) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
