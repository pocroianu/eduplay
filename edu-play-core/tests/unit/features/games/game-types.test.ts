import { describe, it, expect } from 'vitest';
import {
  getCategoryConfig,
  CATEGORY_CONFIG,
  ALL_CATEGORIES,
  type GameCategory,
} from '@/features/games/types/game.types';

/**
 * Unit tests for game type utilities and constants
 */
describe('getCategoryConfig', () => {
  it('should return correct config for each valid category', () => {
    const validCategories: GameCategory[] = ['literacy', 'math', 'phonics', 'shapes', 'colors', 'vocabulary'];
    for (const category of validCategories) {
      const config = getCategoryConfig(category);
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.icon).toBeTruthy();
    }
  });

  it('should return correct label for literacy', () => {
    expect(getCategoryConfig('literacy').label).toBe('Litere');
    expect(getCategoryConfig('literacy').icon).toBe('BookOpen');
  });

  it('should return correct label for math', () => {
    expect(getCategoryConfig('math').label).toBe('Numere');
    expect(getCategoryConfig('math').icon).toBe('Calculator');
  });

  it('should return correct label for phonics', () => {
    expect(getCategoryConfig('phonics').label).toBe('Sunete');
  });

  it('should return correct label for shapes', () => {
    expect(getCategoryConfig('shapes').label).toBe('Forme');
  });

  it('should return correct label for colors', () => {
    expect(getCategoryConfig('colors').label).toBe('Culori');
  });

  it('should return correct label for vocabulary', () => {
    expect(getCategoryConfig('vocabulary').label).toBe('Cuvinte');
  });

  it('should return fallback for null category', () => {
    const config = getCategoryConfig(null);
    expect(config.label).toBe('Jocuri');
    expect(config.icon).toBe('GameController');
  });

  it('should return fallback for unknown category string', () => {
    const config = getCategoryConfig('unknown-category');
    expect(config.label).toBe('Jocuri');
  });

  it('should return fallback for empty string', () => {
    const config = getCategoryConfig('');
    expect(config.label).toBe('Jocuri');
  });
});

describe('CATEGORY_CONFIG', () => {
  it('should contain all 6 categories', () => {
    const keys = Object.keys(CATEGORY_CONFIG);
    expect(keys).toHaveLength(6);
    expect(keys).toContain('literacy');
    expect(keys).toContain('math');
    expect(keys).toContain('phonics');
    expect(keys).toContain('shapes');
    expect(keys).toContain('colors');
    expect(keys).toContain('vocabulary');
  });

  it('should have required fields on each category config', () => {
    for (const config of Object.values(CATEGORY_CONFIG)) {
      expect(config.label).toBeTruthy();
      expect(config.icon).toBeTruthy();
      expect(config.color).toBeTruthy();
      expect(config.bgColor).toBeTruthy();
      expect(config.badgeClass).toBeTruthy();
    }
  });
});

describe('ALL_CATEGORIES', () => {
  it('should contain all 6 game categories', () => {
    expect(ALL_CATEGORIES).toHaveLength(6);
  });

  it('should match CATEGORY_CONFIG keys', () => {
    const configKeys = Object.keys(CATEGORY_CONFIG);
    for (const cat of ALL_CATEGORIES) {
      expect(configKeys).toContain(cat);
    }
  });

  it('should include expected categories', () => {
    expect(ALL_CATEGORIES).toContain('literacy');
    expect(ALL_CATEGORIES).toContain('math');
    expect(ALL_CATEGORIES).toContain('phonics');
    expect(ALL_CATEGORIES).toContain('shapes');
    expect(ALL_CATEGORIES).toContain('colors');
    expect(ALL_CATEGORIES).toContain('vocabulary');
  });
});
