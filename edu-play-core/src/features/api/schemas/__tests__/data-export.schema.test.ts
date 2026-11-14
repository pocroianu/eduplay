import { describe, it, expect } from 'vitest';
import { classExportParamsSchema } from '../data-export.schema';

describe('classExportParamsSchema', () => {
  it('accepts valid UUID classId', () => {
    const result = classExportParamsSchema.safeParse({
      classId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    const result = classExportParamsSchema.safeParse({
      classId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing classId', () => {
    const result = classExportParamsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
