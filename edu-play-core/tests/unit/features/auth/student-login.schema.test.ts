import { describe, it, expect } from 'vitest';
import {
  studentLoginSchema,
  type StudentLoginFormData,
} from '@/features/auth/schemas/student-login.schema';

/**
 * Unit tests for student login schema validation
 * Tests the Zod schema used for student PIN login form validation
 */
describe('studentLoginSchema', () => {
  describe('valid inputs', () => {
    it('should validate correct username and PIN', () => {
      const validData: StudentLoginFormData = {
        username: 'elev.test',
        pin: '1234',
      };

      const result = studentLoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe('elev.test');
        expect(result.data.pin).toBe('1234');
      }
    });

    it('should accept username with minimum 3 characters', () => {
      const validData = {
        username: 'abc',
        pin: '1234',
      };

      const result = studentLoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept username with special characters', () => {
      const validData = {
        username: 'elev_test.1',
        pin: '1234',
      };

      const result = studentLoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept PIN with all zeros', () => {
      const validData = {
        username: 'elev',
        pin: '0000',
      };

      const result = studentLoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept PIN with all nines', () => {
      const validData = {
        username: 'elev',
        pin: '9999',
      };

      const result = studentLoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid username', () => {
    it('should reject username with less than 3 characters', () => {
      const invalidData = {
        username: 'ab',
        pin: '1234',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const usernameError = result.error.issues.find((issue) =>
          issue.path.includes('username')
        );
        expect(usernameError).toBeDefined();
        expect(usernameError?.message).toContain('3');
      }
    });

    it('should reject single character username', () => {
      const invalidData = {
        username: 'a',
        pin: '1234',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty username', () => {
      const invalidData = {
        username: '',
        pin: '1234',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing username', () => {
      const invalidData = {
        pin: '1234',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid PIN', () => {
    it('should reject PIN with less than 4 digits', () => {
      const invalidData = {
        username: 'elev',
        pin: '123',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const pinError = result.error.issues.find((issue) => issue.path.includes('pin'));
        expect(pinError).toBeDefined();
        expect(pinError?.message).toContain('4');
      }
    });

    it('should reject PIN with more than 4 digits', () => {
      const invalidData = {
        username: 'elev',
        pin: '12345',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject PIN with letters', () => {
      const invalidData = {
        username: 'elev',
        pin: '12ab',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const pinError = result.error.issues.find((issue) => issue.path.includes('pin'));
        expect(pinError).toBeDefined();
        expect(pinError?.message).toContain('cifre');
      }
    });

    it('should reject PIN with special characters', () => {
      const invalidData = {
        username: 'elev',
        pin: '12@3',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty PIN', () => {
      const invalidData = {
        username: 'elev',
        pin: '',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing PIN', () => {
      const invalidData = {
        username: 'elev',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject PIN with spaces', () => {
      const invalidData = {
        username: 'elev',
        pin: '1 34',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('error messages', () => {
    it('should return Romanian error message for short username', () => {
      const invalidData = {
        username: 'ab',
        pin: '1234',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const usernameError = result.error.issues.find((issue) =>
          issue.path.includes('username')
        );
        expect(usernameError?.message).toContain('3 caractere');
      }
    });

    it('should return Romanian error message for invalid PIN length', () => {
      const invalidData = {
        username: 'elev',
        pin: '123',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const pinError = result.error.issues.find((issue) => issue.path.includes('pin'));
        expect(pinError?.message).toContain('4 cifre');
      }
    });

    it('should return Romanian error message for non-numeric PIN', () => {
      const invalidData = {
        username: 'elev',
        pin: 'abcd',
      };

      const result = studentLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const pinError = result.error.issues.find((issue) => issue.path.includes('pin'));
        expect(pinError?.message).toContain('doar cifre');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle unicode characters in username', () => {
      const validData = {
        username: 'elev_ăîșț',
        pin: '1234',
      };

      const result = studentLoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle very long username', () => {
      const validData = {
        username: 'a'.repeat(100),
        pin: '1234',
      };

      const result = studentLoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('type inference', () => {
    it('should correctly infer StudentLoginFormData type', () => {
      const data: StudentLoginFormData = {
        username: 'elev',
        pin: '1234',
      };

      expect(typeof data.username).toBe('string');
      expect(typeof data.pin).toBe('string');
    });
  });
});
