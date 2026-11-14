import { describe, it, expect } from 'vitest';
import { createGameSchema, updateGameSchema } from '../game.schema';

describe('createGameSchema', () => {
  it('accepts valid input with all required fields', () => {
    const result = createGameSchema.safeParse({
      title: 'Math Adventure',
      gameUrl: 'https://example.com/game',
      description: 'A fun math game',
      category: 'math',
      difficultyLevel: 3,
      targetAgeMin: 5,
      targetAgeMax: 10,
      estimatedDuration: 30,
      isPublished: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing title', () => {
    const result = createGameSchema.safeParse({
      gameUrl: 'https://example.com/game',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing gameUrl', () => {
    const result = createGameSchema.safeParse({
      title: 'Math Adventure',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = createGameSchema.safeParse({
      title: 'Math Adventure',
      gameUrl: 'https://example.com/game',
      category: 'invalid-category',
    });
    expect(result.success).toBe(false);
  });

  it('rejects difficulty out of range (0)', () => {
    const result = createGameSchema.safeParse({
      title: 'Math Adventure',
      gameUrl: 'https://example.com/game',
      difficultyLevel: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects difficulty out of range (6)', () => {
    const result = createGameSchema.safeParse({
      title: 'Math Adventure',
      gameUrl: 'https://example.com/game',
      difficultyLevel: 6,
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid partial input (title + gameUrl only) with defaults', () => {
    const result = createGameSchema.safeParse({
      title: 'Simple Game',
      gameUrl: 'https://example.com/simple',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isPublished).toBe(false);
    }
  });
});

describe('updateGameSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = updateGameSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial update with just title', () => {
    const result = updateGameSchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
  });
});
