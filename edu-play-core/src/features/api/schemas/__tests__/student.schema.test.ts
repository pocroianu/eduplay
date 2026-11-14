import { describe, it, expect } from 'vitest';
import { createStudentSchema, listStudentsQuerySchema } from '../student.schema';

describe('createStudentSchema', () => {
  it('accepts valid input', () => {
    const result = createStudentSchema.safeParse({
      fullName: 'John Doe',
      username: 'johndoe',
      password: 'pass1234',
      classId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects short username (2 chars)', () => {
    const result = createStudentSchema.safeParse({
      fullName: 'John Doe',
      username: 'jd',
      password: 'pass1234',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password (3 chars)', () => {
    const result = createStudentSchema.safeParse({
      fullName: 'John Doe',
      username: 'johndoe',
      password: 'abc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID for classId', () => {
    const result = createStudentSchema.safeParse({
      fullName: 'John Doe',
      username: 'johndoe',
      password: 'pass1234',
      classId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fullName', () => {
    const result = createStudentSchema.safeParse({
      username: 'johndoe',
      password: 'pass1234',
    });
    expect(result.success).toBe(false);
  });
});

describe('listStudentsQuerySchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = listStudentsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts valid classId', () => {
    const result = listStudentsQuerySchema.safeParse({
      classId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });
});
