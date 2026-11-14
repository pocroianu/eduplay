import {
  getTeacherClassIds,
  getParentChildIds,
  assertTeacherOwnsClass,
  assertTeacherOwnsStudent,
  getScopedStudentIds,
  getScopedClassIds,
} from '../scope';
import { ApiError } from '../errors';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Lightweight Supabase query mock. Each `from()` call returns a thenable builder
 * whose terminal `.then()` resolves with the value the test scripted via
 * `mockSupabase()`.
 */
function makeBuilder<T>(result: { data: T | null; error: { message: string } | null }) {
  const builder: Record<string, unknown> = {};
  const chain = ['select', 'eq', 'in'] as const;
  for (const fn of chain) {
    builder[fn] = () => builder;
  }
  builder.single = () => Promise.resolve(result);
  // Some callers `await` the builder directly (no `.single()`). Make the
  // builder thenable so it resolves with the same shape.
  builder.then = (
    onFulfilled: (value: { data: T | null; error: { message: string } | null }) => unknown,
  ) => Promise.resolve(result).then(onFulfilled);
  return builder;
}

interface Scenario {
  table: string;
  result: { data: unknown; error: { message: string } | null };
}

function mockSupabase(scenarios: Scenario[]): SupabaseClient {
  const queue = [...scenarios];
  return {
    from(table: string) {
      const next = queue.shift();
      if (!next) throw new Error(`Unexpected supabase.from('${table}') with empty queue`);
      if (next.table !== table) {
        throw new Error(`Expected supabase.from('${next.table}'), got '${table}'`);
      }
      return makeBuilder(next.result as { data: unknown; error: { message: string } | null });
    },
  } as unknown as SupabaseClient;
}

describe('getTeacherClassIds', () => {
  it('returns the teacher\'s class ids', async () => {
    const supabase = mockSupabase([
      {
        table: 'classes',
        result: { data: [{ id: 'c1' }, { id: 'c2' }], error: null },
      },
    ]);
    expect(await getTeacherClassIds(supabase, 't1')).toEqual(['c1', 'c2']);
  });

  it('returns an empty array when the teacher has no classes', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: [], error: null } },
    ]);
    expect(await getTeacherClassIds(supabase, 't1')).toEqual([]);
  });

  it('throws ApiError on database error', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: null, error: { message: 'boom' } } },
    ]);
    await expect(getTeacherClassIds(supabase, 't1')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('getParentChildIds', () => {
  it('returns student_ids from active parent_children rows', async () => {
    const supabase = mockSupabase([
      {
        table: 'parent_children',
        result: {
          data: [{ student_id: 's1' }, { student_id: 's2' }],
          error: null,
        },
      },
    ]);
    expect(await getParentChildIds(supabase, 'p1')).toEqual(['s1', 's2']);
  });

  it('returns empty array when no children are linked', async () => {
    const supabase = mockSupabase([
      { table: 'parent_children', result: { data: [], error: null } },
    ]);
    expect(await getParentChildIds(supabase, 'p1')).toEqual([]);
  });
});

describe('assertTeacherOwnsClass', () => {
  it('returns silently when class belongs to teacher', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: { id: 'c1' }, error: null } },
    ]);
    await expect(assertTeacherOwnsClass(supabase, 't1', 'c1')).resolves.toBeUndefined();
  });

  it('throws notFound when class does not belong to teacher', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: null, error: { message: 'no rows' } } },
    ]);
    await expect(assertTeacherOwnsClass(supabase, 't1', 'c1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('assertTeacherOwnsStudent', () => {
  it('returns the student row when the student is in one of the teacher\'s classes', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: [{ id: 'c1' }], error: null } },
      { table: 'students', result: { data: { id: 's1', class_id: 'c1' }, error: null } },
    ]);
    await expect(assertTeacherOwnsStudent(supabase, 't1', 's1')).resolves.toEqual({
      id: 's1',
      class_id: 'c1',
    });
  });

  it('throws notFound when teacher has no classes', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: [], error: null } },
    ]);
    await expect(assertTeacherOwnsStudent(supabase, 't1', 's1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws notFound when student is not in teacher\'s classes', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: [{ id: 'c1' }], error: null } },
      { table: 'students', result: { data: null, error: { message: 'no rows' } } },
    ]);
    await expect(assertTeacherOwnsStudent(supabase, 't1', 's1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('getScopedStudentIds', () => {
  it('student role: returns only the student\'s own id', async () => {
    const supabase = mockSupabase([]);
    const result = await getScopedStudentIds(supabase, { id: 'me', role: 'student' });
    expect(result).toEqual({ studentIds: ['me'] });
  });

  it('student role: ignores requestedStudentId (cannot pivot to another student)', async () => {
    const supabase = mockSupabase([]);
    const result = await getScopedStudentIds(
      supabase,
      { id: 'me', role: 'student' },
      { requestedStudentId: 'other' },
    );
    expect(result).toEqual({ studentIds: ['me'] });
  });

  it('teacher role: returns all students in their classes', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: [{ id: 'c1' }, { id: 'c2' }], error: null } },
      { table: 'students', result: { data: [{ id: 's1' }, { id: 's2' }], error: null } },
    ]);
    const result = await getScopedStudentIds(supabase, { id: 't1', role: 'teacher' });
    expect(result).toEqual({ studentIds: ['s1', 's2'] });
  });

  it('teacher role with no classes: returns empty without forbidden error', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: [], error: null } },
    ]);
    const result = await getScopedStudentIds(supabase, { id: 't1', role: 'teacher' });
    expect(result).toEqual({ studentIds: [] });
  });

  it('teacher role with requestedStudentId in their class: narrows to that id', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: [{ id: 'c1' }], error: null } },
      { table: 'students', result: { data: { id: 's1', class_id: 'c1' }, error: null } },
    ]);
    const result = await getScopedStudentIds(
      supabase,
      { id: 't1', role: 'teacher' },
      { requestedStudentId: 's1' },
    );
    expect(result).toEqual({ studentIds: ['s1'] });
  });

  it('teacher role with requestedStudentId outside their classes: throws forbidden', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: [{ id: 'c1' }], error: null } },
      { table: 'students', result: { data: { id: 's2', class_id: 'c2' }, error: null } },
    ]);
    await expect(
      getScopedStudentIds(
        supabase,
        { id: 't1', role: 'teacher' },
        { requestedStudentId: 's2' },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('parent role: returns linked children', async () => {
    const supabase = mockSupabase([
      {
        table: 'parent_children',
        result: { data: [{ student_id: 's1' }, { student_id: 's2' }], error: null },
      },
    ]);
    const result = await getScopedStudentIds(supabase, { id: 'p1', role: 'parent' });
    expect(result).toEqual({ studentIds: ['s1', 's2'] });
  });

  it('parent role with requestedStudentId not their child: throws forbidden', async () => {
    const supabase = mockSupabase([
      {
        table: 'parent_children',
        result: { data: [{ student_id: 's1' }], error: null },
      },
    ]);
    await expect(
      getScopedStudentIds(
        supabase,
        { id: 'p1', role: 'parent' },
        { requestedStudentId: 'stranger' },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('admin or unknown role: returns unsupportedRole flag', async () => {
    const supabase = mockSupabase([]);
    const result = await getScopedStudentIds(supabase, { id: 'a1', role: 'admin' });
    expect(result).toEqual({ studentIds: [], unsupportedRole: true });
  });
});

describe('getScopedClassIds', () => {
  it('teacher role: returns owned class ids', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: [{ id: 'c1' }, { id: 'c2' }], error: null } },
    ]);
    const result = await getScopedClassIds(supabase, { id: 't1', role: 'teacher' });
    expect(result).toEqual({ classIds: ['c1', 'c2'] });
  });

  it('teacher role with requestedClassId they own: narrows to that id', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: [{ id: 'c1' }], error: null } },
    ]);
    const result = await getScopedClassIds(
      supabase,
      { id: 't1', role: 'teacher' },
      { requestedClassId: 'c1' },
    );
    expect(result).toEqual({ classIds: ['c1'] });
  });

  it('teacher role with requestedClassId they do not own: throws notFound', async () => {
    const supabase = mockSupabase([
      { table: 'classes', result: { data: [{ id: 'c1' }], error: null } },
    ]);
    await expect(
      getScopedClassIds(
        supabase,
        { id: 't1', role: 'teacher' },
        { requestedClassId: 'stranger' },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('non-teacher role: returns unsupportedRole flag', async () => {
    const supabase = mockSupabase([]);
    const result = await getScopedClassIds(supabase, { id: 's1', role: 'student' });
    expect(result).toEqual({ classIds: [], unsupportedRole: true });
  });
});
