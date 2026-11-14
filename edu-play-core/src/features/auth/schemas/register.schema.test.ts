import { describe, it, expect } from 'vitest';
import { registerSchema, type RegisterFormData } from './register.schema';

/**
 * Unit tests for teacher/parent registration schema
 */
describe('registerSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid teacher registration', () => {
      const data: RegisterFormData = {
        email: 'teacher@scoala.ro',
        password: 'Parola123!',
        confirmPassword: 'Parola123!',
        fullName: 'Ana Maria',
        role: 'teacher',
      };
      expect(registerSchema.safeParse(data).success).toBe(true);
    });

    it('should accept valid parent registration', () => {
      const result = registerSchema.safeParse({
        email: 'parinte@gmail.com',
        password: 'Securepass1!',
        confirmPassword: 'Securepass1!',
        fullName: 'Ion Popescu',
        role: 'parent',
      });
      expect(result.success).toBe(true);
    });

    it('should accept a strong password', () => {
      const result = registerSchema.safeParse({
        email: 'test@test.com',
        password: 'Strong123!',
        confirmPassword: 'Strong123!',
        fullName: 'Test User',
        role: 'teacher',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('password confirmation', () => {
    it('should reject when passwords do not match', () => {
      const result = registerSchema.safeParse({
        email: 'test@test.com',
        password: 'Password1!',
        confirmPassword: 'Password2!',
        fullName: 'Test User',
        role: 'teacher',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) => i.path.includes('confirmPassword'));
        expect(err?.message).toContain('Parolele nu se potrivesc');
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({
        email: 'not-an-email',
        password: 'Password1!',
        confirmPassword: 'Password1!',
        fullName: 'Test User',
        role: 'teacher',
      });
      expect(result.success).toBe(false);
    });

    it('should reject weak passwords', () => {
      const result = registerSchema.safeParse({
        email: 'test@test.com',
        password: '12345',
        confirmPassword: '12345',
        fullName: 'Test User',
        role: 'teacher',
      });
      expect(result.success).toBe(false);
    });

    it('should reject fullName shorter than 2 chars', () => {
      const result = registerSchema.safeParse({
        email: 'test@test.com',
        password: 'Password1!',
        confirmPassword: 'Password1!',
        fullName: 'A',
        role: 'teacher',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid role', () => {
      const result = registerSchema.safeParse({
        email: 'test@test.com',
        password: 'Password1!',
        confirmPassword: 'Password1!',
        fullName: 'Test User',
        role: 'admin',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing fields', () => {
      expect(registerSchema.safeParse({}).success).toBe(false);
    });
  });
});
