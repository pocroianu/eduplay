import { describe, it, expect } from 'vitest';
import { calculatePasswordStrength } from './calculate-password-strength';

describe('calculatePasswordStrength', () => {
  it('should return score 0 and 0% for empty password', () => {
    const result = calculatePasswordStrength('');
    expect(result.score).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.label).toBe('Foarte slabă');
    expect(result.color).toBe('red');
  });

  it('should return a low score for a weak password', () => {
    const result = calculatePasswordStrength('123');
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.percentage).toBeGreaterThan(0);
  });

  it('should return a higher score for a stronger password', () => {
    const weak = calculatePasswordStrength('abc');
    const strong = calculatePasswordStrength('MyStr0ng!P@ssw0rd#2024');
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it('should return score 4 for a very strong password', () => {
    const result = calculatePasswordStrength('Xq9#mK2$vL7@nR4!wZ');
    expect(result.score).toBe(4);
    expect(result.label).toBe('Foarte bună');
    expect(result.color).toBe('green');
    expect(result.percentage).toBe(100);
  });

  it('should have percentage between 0 and 100', () => {
    const passwords = ['', 'a', 'abc', 'abcdef', 'Abcdef1!', 'MyStr0ng!Pass#2024'];
    for (const password of passwords) {
      const result = calculatePasswordStrength(password);
      expect(result.percentage).toBeGreaterThanOrEqual(0);
      expect(result.percentage).toBeLessThanOrEqual(100);
    }
  });

  it('should return valid color class for all scores', () => {
    const passwords = ['', 'a', 'test', 'Test12', 'Test123!', 'Xq9#mK2$vL7@nR4!'];
    for (const password of passwords) {
      const result = calculatePasswordStrength(password);
      expect(result.colorClass).toBeTruthy();
      expect(result.textColorClass).toBeTruthy();
      expect(result.colorClass).toMatch(/^bg-/);
      expect(result.textColorClass).toMatch(/^text-/);
    }
  });

  it('should return valid labels in Romanian for all scores', () => {
    const expectedLabels = [
      'Foarte slabă',
      'Slabă',
      'Acceptabilă',
      'Bună',
      'Foarte bună',
    ];

    const passwords = ['', 'a', 'abcde', 'Test123', 'MyStr0ng!P@ssw0rd#2024'];
    for (const password of passwords) {
      const result = calculatePasswordStrength(password);
      expect(expectedLabels).toContain(result.label);
    }
  });

  it('should have score matching the score range 0-4', () => {
    const passwords = ['', 'a', 'abcde', 'Test123!', 'Xq9#mK2$vL7@nR4!wZ'];
    for (const password of passwords) {
      const result = calculatePasswordStrength(password);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(4);
    }
  });
});
