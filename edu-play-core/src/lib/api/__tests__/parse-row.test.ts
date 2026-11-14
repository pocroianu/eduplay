import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError } from '../errors';
import { parseMaybeRow, parseRow, parseRows } from '../parse-row';

const rowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  count: z.number().int(),
});

const VALID_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Hello',
  count: 3,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseRow', () => {
  it('returns parsed data when the row matches the schema', () => {
    const result = parseRow(VALID_ROW, rowSchema, 'test:row');
    expect(result).toEqual(VALID_ROW);
  });

  it('strips unknown fields by default to stay forward-compatible with new columns', () => {
    const withExtra = { ...VALID_ROW, addedLater: 'ignored' };
    const result = parseRow(withExtra, rowSchema, 'test:row');
    expect(result).toEqual(VALID_ROW);
    expect(result).not.toHaveProperty('addedLater');
  });

  it('throws ApiError(INTERNAL_ERROR) when the row fails validation', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bad = { id: 'not-a-uuid', title: 42, count: 'three' };

    expect(() => parseRow(bad, rowSchema, 'test:row')).toThrow(ApiError);

    try {
      parseRow(bad, rowSchema, 'test:row');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('INTERNAL_ERROR');
      expect(apiErr.status).toBe(500);
      expect(apiErr.message).not.toMatch(/uuid|number/i);
    }

    expect(errSpy).toHaveBeenCalled();
    const [tag, payload] = errSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(tag).toBe('[parseRow] schema drift detected');
    expect(payload).toMatchObject({ context: 'test:row' });
    expect(Array.isArray(payload.issues)).toBe(true);
  });

  it('caps logged issues to limit log spam on heavily drifted rows', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const wide = z.object({
      a: z.string(),
      b: z.string(),
      c: z.string(),
      d: z.string(),
      e: z.string(),
      f: z.string(),
      g: z.string(),
    });
    const bad = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 };

    expect(() => parseRow(bad, wide, 'test:wide')).toThrow(ApiError);
    const [, payload] = errSpy.mock.calls[0] as [string, { issueCount: number; issues: unknown[] }];
    expect(payload.issueCount).toBe(7);
    expect(payload.issues.length).toBe(5);
  });
});

describe('parseRows', () => {
  it('parses every row and includes the index in the context on failure', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rows = [VALID_ROW, { ...VALID_ROW, count: 'oops' }];

    expect(() => parseRows(rows, rowSchema, 'list:games')).toThrow(ApiError);
    const [, payload] = errSpy.mock.calls[0] as [string, { context: string }];
    expect(payload.context).toBe('list:games[1]');
  });

  it('returns parsed array when all rows match', () => {
    const rows = [VALID_ROW, { ...VALID_ROW, id: '22222222-2222-4222-8222-222222222222' }];
    expect(parseRows(rows, rowSchema, 'list:games')).toHaveLength(2);
  });

  it('returns an empty array for an empty input', () => {
    expect(parseRows([], rowSchema, 'list:games')).toEqual([]);
  });
});

describe('parseMaybeRow', () => {
  it('returns null when the row is null', () => {
    expect(parseMaybeRow(null, rowSchema, 'maybe:row')).toBeNull();
  });

  it('returns null when the row is undefined', () => {
    expect(parseMaybeRow(undefined, rowSchema, 'maybe:row')).toBeNull();
  });

  it('parses a present row', () => {
    expect(parseMaybeRow(VALID_ROW, rowSchema, 'maybe:row')).toEqual(VALID_ROW);
  });
});
