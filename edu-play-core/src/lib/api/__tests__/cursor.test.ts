import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor } from '../cursor';

describe('cursor', () => {
  it('round-trips a (createdAt, id) tuple', () => {
    const tuple = {
      createdAt: '2026-04-26T15:00:00.000Z',
      id: '11111111-1111-1111-1111-111111111111',
    };
    const enc = encodeCursor(tuple);
    expect(enc).not.toContain('|');
    expect(decodeCursor(enc)).toEqual(tuple);
  });

  it('returns null for malformed cursors', () => {
    expect(decodeCursor('garbage')).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor(Buffer.from('only-one-piece').toString('base64url'))).toBeNull();
    expect(
      decodeCursor(Buffer.from('not-a-date|some-id').toString('base64url')),
    ).toBeNull();
  });
});
