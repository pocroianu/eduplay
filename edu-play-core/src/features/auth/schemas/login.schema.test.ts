/**
 * Colocated unit tests for login schema
 * This file demonstrates the pattern of placing tests next to the source file
 */
import { describe, it, expect } from 'vitest';
import { loginSchema, type LoginFormData } from './login.schema';

describe('loginSchema (colocated test)', () => {
  it('validates correct input', () => {
    const validData: LoginFormData = {
      email: 'teacher@eduplay.ro',
      password: 'securePassword123',
    };

    const result = loginSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-valid',
      password: 'password123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Email invalid');
    }
  });

  it('rejects short password', () => {
    const result = loginSchema.safeParse({
      email: 'valid@email.com',
      password: '123',
    });

    expect(result.success).toBe(false);
  });
});
