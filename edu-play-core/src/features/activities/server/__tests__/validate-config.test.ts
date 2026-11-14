import { describe, it, expect } from 'vitest';

import { ApiError } from '@/lib/api';

import {
  parseConfigOrThrow,
  validateConfig,
} from '../validate-config';

const multipleChoiceSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['question', 'options', 'answerIndex'],
  additionalProperties: false,
  properties: {
    question: { type: 'string', minLength: 1 },
    options: {
      type: 'array',
      minItems: 2,
      maxItems: 6,
      items: { type: 'string', minLength: 1 },
    },
    answerIndex: { type: 'integer', minimum: 0 },
  },
};

const tracingSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['glyph', 'strokes'],
  properties: {
    glyph: { type: 'string', minLength: 1, maxLength: 4 },
    strokes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['points'],
        properties: {
          points: {
            type: 'array',
            items: {
              type: 'array',
              minItems: 2,
              maxItems: 2,
              items: { type: 'number' },
            },
          },
        },
      },
    },
  },
};

describe('validateConfig', () => {
  describe('multiple-choice', () => {
    it('accepts a well-formed config', () => {
      const data = {
        question: 'Care literă lipsește?',
        options: ['A', 'B', 'C'],
        answerIndex: 1,
      };
      expect(validateConfig(multipleChoiceSchema, data)).toEqual({ ok: true });
    });

    it('rejects a missing required field', () => {
      const data = { question: 'X', options: ['A', 'B'] };
      const result = validateConfig(multipleChoiceSchema, data);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.some((e) => e.keyword === 'required')).toBe(true);
      expect(result.errors[0].message).toContain('answerIndex');
    });

    it('rejects when options has fewer than minItems', () => {
      const data = {
        question: 'X',
        options: ['only-one'],
        answerIndex: 0,
      };
      const result = validateConfig(multipleChoiceSchema, data);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const minItemsErr = result.errors.find((e) => e.keyword === 'minItems');
      expect(minItemsErr).toBeDefined();
      expect(minItemsErr!.path).toBe('/options');
    });

    it('rejects an unknown property when additionalProperties=false', () => {
      const data = {
        question: 'X',
        options: ['A', 'B'],
        answerIndex: 0,
        secretField: 'oops',
      };
      const result = validateConfig(multipleChoiceSchema, data);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(
        result.errors.some((e) => e.keyword === 'additionalProperties'),
      ).toBe(true);
    });

    it('reports all errors when allErrors mode is on', () => {
      const data = { question: '', options: [], answerIndex: -1 };
      const result = validateConfig(multipleChoiceSchema, data);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      // Three independent failures should all surface in one shot.
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('tracing-game', () => {
    it('accepts a stroke with valid 2D points', () => {
      const data = {
        glyph: 'A',
        strokes: [{ points: [[0, 0], [10, 10], [20, 0]] }],
      };
      expect(validateConfig(tracingSchema, data)).toEqual({ ok: true });
    });

    it('rejects a stroke point of wrong arity', () => {
      const data = {
        glyph: 'A',
        strokes: [{ points: [[0, 0, 0]] }],
      };
      const result = validateConfig(tracingSchema, data);
      expect(result.ok).toBe(false);
    });

    it('rejects a glyph longer than maxLength', () => {
      const data = {
        glyph: 'AAAAA',
        strokes: [{ points: [[0, 0], [1, 1]] }],
      };
      const result = validateConfig(tracingSchema, data);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.some((e) => e.keyword === 'maxLength')).toBe(true);
    });
  });

  describe('schema compile errors', () => {
    it('reports a non-object schema cleanly without throwing', () => {
      const result = validateConfig('not-a-schema', {});
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0].keyword).toBe('schemaCompileError');
    });

    it('reports a structurally invalid JSON Schema', () => {
      // `type: 123` is not valid JSON Schema syntax.
      const result = validateConfig({ type: 123 }, {});
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0].keyword).toBe('schemaCompileError');
    });
  });
});

describe('parseConfigOrThrow', () => {
  it('returns silently on valid data', () => {
    const data = {
      question: 'X',
      options: ['A', 'B'],
      answerIndex: 0,
    };
    expect(() =>
      parseConfigOrThrow(multipleChoiceSchema, data, 'test'),
    ).not.toThrow();
  });

  it('throws ApiError with VALIDATION_ERROR code on bad data', () => {
    const data = { question: 'X' };
    let caught: unknown;
    try {
      parseConfigOrThrow(multipleChoiceSchema, data, 'POST /api/v1/admin/activities');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    const err = caught as ApiError;
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.status).toBe(422);
    expect(err.details?.context).toBe('POST /api/v1/admin/activities');
    expect(Array.isArray(err.details?.errors)).toBe(true);
  });
});
