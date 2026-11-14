import { describe, it, expect } from 'vitest';
import { createDeletionRequestSchema } from '../deletion-request.schema';

describe('createDeletionRequestSchema', () => {
  it('accepts valid input with reason', () => {
    const result = createDeletionRequestSchema.safeParse({
      reason: 'No longer using the platform',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (reason is optional)', () => {
    const result = createDeletionRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects reason over 500 chars', () => {
    const result = createDeletionRequestSchema.safeParse({
      reason: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from reason', () => {
    const result = createDeletionRequestSchema.safeParse({
      reason: '  some reason  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBe('some reason');
    }
  });
});
