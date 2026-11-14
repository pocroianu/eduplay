import { describe, it, expect } from 'vitest';
import { forgotPasswordSchema } from './forgot-password.schema';

describe('forgotPasswordSchema', () => {
  it('should accept a valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'test@example.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
    }
  });

  it('should reject empty email', () => {
    const result = forgotPasswordSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid email format', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('should convert email to lowercase', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'Test@Example.COM' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
    }
  });

  it('should trim whitespace from email', () => {
    const result = forgotPasswordSchema.safeParse({ email: '  test@example.com  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
    }
  });

  it('should reject email without domain', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'test@' });
    expect(result.success).toBe(false);
  });

  it('should reject email without @ symbol', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'testexample.com' });
    expect(result.success).toBe(false);
  });

  it('should reject missing email field', () => {
    const result = forgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
