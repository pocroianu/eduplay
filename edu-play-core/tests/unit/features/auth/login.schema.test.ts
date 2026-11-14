import { describe, it, expect } from 'vitest';
import { loginSchema, type LoginFormData } from '@/features/auth/schemas/login.schema';

/**
 * Unit tests for login schema validation
 * Tests the Zod schema used for teacher login form validation
 */
describe('loginSchema', () => {
  describe('valid inputs', () => {
    it('should validate a correct email and password', () => {
      const validData: LoginFormData = {
        email: 'teacher@example.com',
        password: 'password123',
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('teacher@example.com');
        expect(result.data.password).toBe('password123');
      }
    });

    it('should accept email with Romanian domain', () => {
      const validData = {
        email: 'profesor@scoala.ro',
        password: 'parola123',
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept password with exactly 6 characters', () => {
      const validData = {
        email: 'teacher@example.com',
        password: '123456',
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept long passwords', () => {
      const validData = {
        email: 'teacher@example.com',
        password: 'a'.repeat(100),
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('should reject empty email', () => {
      const invalidData = {
        email: '',
        password: 'password123',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email format', () => {
      const invalidEmails = [
        'not-an-email',
        'missing@domain',
        '@no-local-part.com',
        'spaces in@email.com',
        'email@.com',
      ];

      for (const email of invalidEmails) {
        const result = loginSchema.safeParse({
          email,
          password: 'password123',
        });
        expect(result.success).toBe(false);
      }
    });

    it('should reject password shorter than 6 characters', () => {
      const invalidData = {
        email: 'teacher@example.com',
        password: '12345',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const passwordError = result.error.issues.find((issue) => issue.path.includes('password'));
        expect(passwordError).toBeDefined();
        expect(passwordError?.message).toContain('6');
      }
    });

    it('should reject empty password', () => {
      const invalidData = {
        email: 'teacher@example.com',
        password: '',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing email', () => {
      const invalidData = {
        password: 'password123',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const invalidData = {
        email: 'teacher@example.com',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('error messages', () => {
    it('should return Romanian error message for invalid email', () => {
      const invalidData = {
        email: 'invalid',
        password: 'password123',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const emailError = result.error.issues.find((issue) => issue.path.includes('email'));
        expect(emailError?.message).toBe('Email invalid');
      }
    });

    it('should return Romanian error message for short password', () => {
      const invalidData = {
        email: 'teacher@example.com',
        password: '123',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const passwordError = result.error.issues.find((issue) => issue.path.includes('password'));
        expect(passwordError?.message).toContain('cel puțin 6 caractere');
      }
    });
  });

  describe('type inference', () => {
    it('should correctly infer LoginFormData type', () => {
      const data: LoginFormData = {
        email: 'test@test.com',
        password: 'password',
      };

      // Type check - this will fail at compile time if types are wrong
      expect(typeof data.email).toBe('string');
      expect(typeof data.password).toBe('string');
    });
  });
});
