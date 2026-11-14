import { describe, it, expect } from 'vitest';
import {
  resetPasswordSchema,
  passwordRequirementChecks,
  passwordRequirementLabels,
} from './reset-password.schema';

describe('resetPasswordSchema', () => {
  it('should accept a valid password with all requirements', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'StrongPass1!',
      confirmPassword: 'StrongPass1!',
    });
    expect(result.success).toBe(true);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'Aa1!',
      confirmPassword: 'Aa1!',
    });
    expect(result.success).toBe(false);
  });

  it('should reject password without uppercase letter', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'lowercase1!',
      confirmPassword: 'lowercase1!',
    });
    expect(result.success).toBe(false);
  });

  it('should reject password without lowercase letter', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'UPPERCASE1!',
      confirmPassword: 'UPPERCASE1!',
    });
    expect(result.success).toBe(false);
  });

  it('should reject password without number', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'NoNumbers!abc',
      confirmPassword: 'NoNumbers!abc',
    });
    expect(result.success).toBe(false);
  });

  it('should reject password without special character', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'NoSpecial1abc',
      confirmPassword: 'NoSpecial1abc',
    });
    expect(result.success).toBe(false);
  });

  it('should reject mismatched passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'StrongPass1!',
      confirmPassword: 'DifferentPass1!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mismatchError = result.error.issues.find(
        (issue) => issue.path.includes('confirmPassword')
      );
      expect(mismatchError).toBeDefined();
    }
  });

  it('should reject empty confirm password', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'StrongPass1!',
      confirmPassword: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = resetPasswordSchema.safeParse({
      password: '',
      confirmPassword: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('passwordRequirementChecks', () => {
  describe('minLength', () => {
    it('should return true for 8+ character password', () => {
      expect(passwordRequirementChecks.minLength('12345678')).toBe(true);
    });

    it('should return false for less than 8 characters', () => {
      expect(passwordRequirementChecks.minLength('1234567')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(passwordRequirementChecks.minLength('')).toBe(false);
    });
  });

  describe('hasUppercase', () => {
    it('should return true when password has uppercase', () => {
      expect(passwordRequirementChecks.hasUppercase('testA')).toBe(true);
    });

    it('should return false when password has no uppercase', () => {
      expect(passwordRequirementChecks.hasUppercase('test')).toBe(false);
    });
  });

  describe('hasLowercase', () => {
    it('should return true when password has lowercase', () => {
      expect(passwordRequirementChecks.hasLowercase('TESTa')).toBe(true);
    });

    it('should return false when password has no lowercase', () => {
      expect(passwordRequirementChecks.hasLowercase('TEST123')).toBe(false);
    });
  });

  describe('hasNumber', () => {
    it('should return true when password has number', () => {
      expect(passwordRequirementChecks.hasNumber('test1')).toBe(true);
    });

    it('should return false when password has no number', () => {
      expect(passwordRequirementChecks.hasNumber('test')).toBe(false);
    });
  });

  describe('hasSpecial', () => {
    it('should return true when password has special character', () => {
      expect(passwordRequirementChecks.hasSpecial('test!')).toBe(true);
      expect(passwordRequirementChecks.hasSpecial('test@')).toBe(true);
      expect(passwordRequirementChecks.hasSpecial('test#')).toBe(true);
      expect(passwordRequirementChecks.hasSpecial('test$')).toBe(true);
    });

    it('should return false when password has no special character', () => {
      expect(passwordRequirementChecks.hasSpecial('test123ABC')).toBe(false);
    });
  });
});

describe('passwordRequirementLabels', () => {
  it('should have labels for all requirement checks', () => {
    const checkKeys = Object.keys(passwordRequirementChecks);
    const labelKeys = Object.keys(passwordRequirementLabels);

    expect(labelKeys).toEqual(expect.arrayContaining(checkKeys));
  });

  it('should have non-empty labels', () => {
    for (const label of Object.values(passwordRequirementLabels)) {
      expect(label).toBeTruthy();
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
