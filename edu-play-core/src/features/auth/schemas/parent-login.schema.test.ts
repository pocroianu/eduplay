import { describe, it, expect } from 'vitest';
import { parentLoginSchema, parentRegisterSchema } from './parent-login.schema';

/**
 * Unit tests for parent login and registration schemas
 */
describe('parentLoginSchema', () => {
  it('should accept valid email and password', () => {
    const result = parentLoginSchema.safeParse({
      email: 'mama@gmail.com',
      password: 'parola123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    expect(parentLoginSchema.safeParse({ email: 'invalid', password: 'pass123' }).success).toBe(false);
  });

  it('should reject password shorter than 6 chars', () => {
    expect(parentLoginSchema.safeParse({ email: 'test@test.com', password: '12345' }).success).toBe(false);
  });
});

describe('parentRegisterSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid registration without invite code', () => {
      const result = parentRegisterSchema.safeParse({
        email: 'mama@gmail.com',
        password: 'Parola123!',
        confirmPassword: 'Parola123!',
        fullName: 'Maria Ionescu',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid registration with all optional fields', () => {
      const result = parentRegisterSchema.safeParse({
        email: 'mama@gmail.com',
        password: 'Parola123!',
        confirmPassword: 'Parola123!',
        fullName: 'Maria Ionescu',
        phoneNumber: '0722123456',
        inviteCode: 'ABC12345',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty invite code', () => {
      const result = parentRegisterSchema.safeParse({
        email: 'mama@gmail.com',
        password: 'Parola123!',
        confirmPassword: 'Parola123!',
        fullName: 'Maria Ionescu',
        inviteCode: '',
      });
      expect(result.success).toBe(true);
    });

    it('should uppercase and normalize invite code', () => {
      const result = parentRegisterSchema.safeParse({
        email: 'mama@gmail.com',
        password: 'Parola123!',
        confirmPassword: 'Parola123!',
        fullName: 'Maria Ionescu',
        inviteCode: 'abc-12345',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.inviteCode).toBe('ABC12345');
      }
    });
  });

  describe('password confirmation', () => {
    it('should reject mismatched passwords', () => {
      const result = parentRegisterSchema.safeParse({
        email: 'mama@gmail.com',
        password: 'Parola123!',
        confirmPassword: 'Altaparola123!',
        fullName: 'Maria Ionescu',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) => i.path.includes('confirmPassword'));
        expect(err?.message).toContain('Parolele nu se potrivesc');
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject invite code that is not 8 chars after normalization', () => {
      const result = parentRegisterSchema.safeParse({
        email: 'mama@gmail.com',
        password: 'Parola123!',
        confirmPassword: 'Parola123!',
        fullName: 'Maria Ionescu',
        inviteCode: 'SHORT',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = parentRegisterSchema.safeParse({
        email: 'not-email',
        password: 'Parola123!',
        confirmPassword: 'Parola123!',
        fullName: 'Maria Ionescu',
      });
      expect(result.success).toBe(false);
    });

    it('should reject weak passwords', () => {
      const result = parentRegisterSchema.safeParse({
        email: 'mama@gmail.com',
        password: 'parola123',
        confirmPassword: 'parola123',
        fullName: 'Maria Ionescu',
      });
      expect(result.success).toBe(false);
    });
  });
});
