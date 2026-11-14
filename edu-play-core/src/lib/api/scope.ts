import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './errors';

/**
 * Authorization scope helpers for role-based API routes.
 *
 * Centralizes the "which students/classes can this user see?" logic so that
 * API routes don't reinvent it (and silently diverge from RLS) every time.
 *
 * Each helper accepts a Supabase client + actor identity and returns the
 * allowed ids. Helpers throw `ApiError` for callers to surface — they do not
 * silently swallow database errors.
 */

type Supabase = SupabaseClient;

/**
 * Return the set of `classes.id` rows this teacher owns.
 * Empty array means the teacher has no classes (caller should treat as empty result).
 */
export async function getTeacherClassIds(
  supabase: Supabase,
  teacherId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id')
    .eq('teacher_id', teacherId);

  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? []).map((c: { id: string }) => c.id);
}

/**
 * Return the set of `students.id` rows linked to this parent via the
 * `parent_children` junction table (active links only).
 */
export async function getParentChildIds(
  supabase: Supabase,
  parentId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('parent_children')
    .select('student_id')
    .eq('parent_id', parentId)
    .eq('status', 'active');

  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return (data ?? []).map((l: { student_id: string }) => l.student_id);
}

/**
 * Verify a class belongs to the teacher. Throws `ApiError.notFound` if not.
 * Returns silently when ownership is confirmed.
 */
export async function assertTeacherOwnsClass(
  supabase: Supabase,
  teacherId: string,
  classId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', teacherId)
    .single();

  if (error || !data) throw ApiError.notFound('Class not found');
}

/**
 * Verify a student is in one of the teacher's classes. Throws `ApiError.notFound`
 * if the student is unknown or not in any of the teacher's classes.
 *
 * Returns the resolved student row so callers can reuse the lookup result.
 * Pass `select` to control which columns come back (defaults to `id, class_id`).
 */
export async function assertTeacherOwnsStudent<TRow = { id: string; class_id: string | null }>(
  supabase: Supabase,
  teacherId: string,
  studentId: string,
  options: { select?: string } = {},
): Promise<TRow> {
  const teacherClassIds = await getTeacherClassIds(supabase, teacherId);

  if (teacherClassIds.length === 0) {
    throw ApiError.notFound('Student not found');
  }

  const { data, error } = await supabase
    .from('students')
    .select(options.select ?? 'id, class_id')
    .eq('id', studentId)
    .in('class_id', teacherClassIds)
    .single();

  if (error || !data) throw ApiError.notFound('Student not found');
  return data as TRow;
}

/**
 * Result of resolving the set of students an authenticated user is allowed to act on.
 *
 * - `studentIds: string[]` — the resolved set (may be empty if the user has no
 *   linked students, in which case callers should short-circuit to an empty result).
 * - `unsupportedRole: true` — the role is not one of student/teacher/parent and
 *   the caller should treat it as out-of-scope (typically: empty paginated response).
 */
export type ScopedStudentResult =
  | { studentIds: string[]; unsupportedRole?: false }
  | { studentIds: never[]; unsupportedRole: true };

/**
 * Resolve the set of student ids the actor is allowed to access, optionally
 * narrowed to a specific `studentId` (e.g. from a query param).
 *
 * - student → always `[user.id]`; any requested studentId is ignored.
 * - teacher → the teacher's class students; if `requestedStudentId` is given,
 *   it must be in one of the teacher's classes (otherwise `ApiError.forbidden`).
 * - parent → linked children only; if `requestedStudentId` is given, it must
 *   be one of those children (otherwise `ApiError.forbidden`).
 * - any other role → `unsupportedRole: true` (caller decides how to surface).
 */
export async function getScopedStudentIds(
  supabase: Supabase,
  actor: { id: string; role: string },
  options: { requestedStudentId?: string } = {},
): Promise<ScopedStudentResult> {
  const { requestedStudentId } = options;

  if (actor.role === 'student') {
    return { studentIds: [actor.id] };
  }

  if (actor.role === 'teacher') {
    const classIds = await getTeacherClassIds(supabase, actor.id);
    if (classIds.length === 0) return { studentIds: [] };

    if (requestedStudentId) {
      const { data, error } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('id', requestedStudentId)
        .single();

      if (error || !data || !classIds.includes(data.class_id)) {
        throw ApiError.forbidden('Student is not in your classes');
      }
      return { studentIds: [requestedStudentId] };
    }

    const { data, error } = await supabase
      .from('students')
      .select('id')
      .in('class_id', classIds);

    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    return { studentIds: (data ?? []).map((s: { id: string }) => s.id) };
  }

  if (actor.role === 'parent') {
    const childIds = await getParentChildIds(supabase, actor.id);
    if (childIds.length === 0) return { studentIds: [] };

    if (requestedStudentId) {
      if (!childIds.includes(requestedStudentId)) {
        throw ApiError.forbidden('Student is not your linked child');
      }
      return { studentIds: [requestedStudentId] };
    }

    return { studentIds: childIds };
  }

  return { studentIds: [], unsupportedRole: true };
}

/**
 * Resolve the set of class ids the actor is allowed to access.
 *
 * - teacher → owned classes (filter by `requestedClassId` if provided; throws
 *   `ApiError.notFound` if the requested class is not theirs).
 * - any other role → `unsupportedRole: true`.
 */
export type ScopedClassResult =
  | { classIds: string[]; unsupportedRole?: false }
  | { classIds: never[]; unsupportedRole: true };

export async function getScopedClassIds(
  supabase: Supabase,
  actor: { id: string; role: string },
  options: { requestedClassId?: string } = {},
): Promise<ScopedClassResult> {
  if (actor.role !== 'teacher') {
    return { classIds: [], unsupportedRole: true };
  }

  const classIds = await getTeacherClassIds(supabase, actor.id);

  if (options.requestedClassId) {
    if (!classIds.includes(options.requestedClassId)) {
      throw ApiError.notFound('Class not found');
    }
    return { classIds: [options.requestedClassId] };
  }

  return { classIds };
}
