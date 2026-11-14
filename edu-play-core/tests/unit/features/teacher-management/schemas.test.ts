import { describe, it, expect } from 'vitest';
import {
  createStudentSchema,
  createClassSchema,
  type CreateStudentFormData,
  type CreateClassFormData,
} from '@/features/teacher-management';

/**
 * Unit tests for teacher-management form schemas
 * Tests Zod validation for student and class CRUD operations
 */
describe('createStudentSchema', () => {
  describe('valid inputs', () => {
    it('should accept full valid student data', () => {
      const data: CreateStudentFormData = {
        fullName: 'Maria Ionescu',
        username: 'maria_i',
        password: 'pass1',
        classId: 'class-uuid-123',
        dateOfBirth: '2018-04-15',
      };
      expect(createStudentSchema.safeParse(data).success).toBe(true);
    });

    it('should accept data without optional fields', () => {
      const result = createStudentSchema.safeParse({
        fullName: 'Ion Pop',
        username: 'ion_pop',
        password: 'abc1',
      });
      expect(result.success).toBe(true);
    });

    it('should accept minimum length fullName (2 chars)', () => {
      const result = createStudentSchema.safeParse({
        fullName: 'AB',
        username: 'ab_user',
        password: 'pass1',
      });
      expect(result.success).toBe(true);
    });

    it('should accept minimum length username (3 chars)', () => {
      const result = createStudentSchema.safeParse({
        fullName: 'Test User',
        username: 'abc',
        password: 'pass1',
      });
      expect(result.success).toBe(true);
    });

    it('should accept minimum length password (4 chars)', () => {
      const result = createStudentSchema.safeParse({
        fullName: 'Test User',
        username: 'testuser',
        password: 'abcd',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('should reject fullName shorter than 2 characters', () => {
      const result = createStudentSchema.safeParse({
        fullName: 'A',
        username: 'validuser',
        password: 'pass1',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) => i.path.includes('fullName'));
        expect(err?.message).toContain('2 caractere');
      }
    });

    it('should reject username shorter than 3 characters', () => {
      const result = createStudentSchema.safeParse({
        fullName: 'Valid Name',
        username: 'ab',
        password: 'pass1',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) => i.path.includes('username'));
        expect(err?.message).toContain('3 caractere');
      }
    });

    it('should reject password shorter than 4 characters', () => {
      const result = createStudentSchema.safeParse({
        fullName: 'Valid Name',
        username: 'validuser',
        password: 'abc',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) => i.path.includes('password'));
        expect(err?.message).toContain('4 caractere');
      }
    });

    it('should reject missing required fields', () => {
      expect(createStudentSchema.safeParse({}).success).toBe(false);
      expect(createStudentSchema.safeParse({ fullName: 'Name' }).success).toBe(false);
      expect(createStudentSchema.safeParse({ username: 'user', password: 'pass1' }).success).toBe(false);
    });
  });
});

describe('createClassSchema', () => {
  describe('valid inputs', () => {
    it('should accept full valid class data', () => {
      const data: CreateClassFormData = {
        name: 'Clasa I A',
        description: 'Clasa pentru copii de 6 ani',
        gradeLevel: 'grade-1',
        schoolYear: '2025-2026',
      };
      expect(createClassSchema.safeParse(data).success).toBe(true);
    });

    it('should accept data with only required name', () => {
      const result = createClassSchema.safeParse({ name: 'Grupa Mica' });
      expect(result.success).toBe(true);
    });

    it('should accept all valid gradeLevel values', () => {
      const levels = ['preschool', 'kindergarten', 'grade-1', 'grade-2'] as const;
      for (const gradeLevel of levels) {
        const result = createClassSchema.safeParse({ name: 'Test Class', gradeLevel });
        expect(result.success).toBe(true);
      }
    });

    it('should accept minimum length name (2 chars)', () => {
      const result = createClassSchema.safeParse({ name: 'AB' });
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('should reject name shorter than 2 characters', () => {
      const result = createClassSchema.safeParse({ name: 'A' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) => i.path.includes('name'));
        expect(err?.message).toContain('2 caractere');
      }
    });

    it('should reject invalid gradeLevel value', () => {
      const result = createClassSchema.safeParse({ name: 'Test Class', gradeLevel: 'grade-5' });
      expect(result.success).toBe(false);
    });

    it('should reject missing name', () => {
      const result = createClassSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
