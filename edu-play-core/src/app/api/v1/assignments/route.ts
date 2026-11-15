import {
  handleRoute,
  requireAuth,
  requireRole,
  parsePagination,
  toRange,
  buildMeta,
  parseBody,
  parseRows,
  created,
  paginated,
  camelCaseKeys,
  ApiError,
} from '@/lib/api';
import {
  assignmentRowSchema,
  createAssignmentSchema,
} from '@/features/api';
import { createTeacherAssignment } from '@/features/teacher-dashboard/server';

/* ------------------------------------------------------------------ */
/*  GET /api/v1/assignments — list assignments (role-scoped)           */
/* ------------------------------------------------------------------ */

const ASSIGNMENT_SELECT =
  '*, activities:activity_id (title, category, difficulty, thumbnail_url)';

export const GET = handleRoute(async (req) => {
  const ctx = await requireAuth();
  const { searchParams } = new URL(req.url);
  const pagination = parsePagination(searchParams);
  const { from, to } = toRange(pagination);

  const role = ctx.profile.role;

  if (role === 'teacher') {
    const { data, error, count } = await ctx.supabase
      .from('assignments')
      .select(ASSIGNMENT_SELECT, { count: 'exact' })
      .eq('teacher_id', ctx.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new ApiError('INTERNAL_ERROR', error.message);
    }

    const rows = parseRows(
      (data ?? []).map(camelCaseKeys),
      assignmentRowSchema,
      'GET /api/v1/assignments[teacher]',
    );
    const meta = buildMeta(pagination, count ?? 0);
    return paginated(rows, meta);
  }

  if (role === 'student') {
    const { data: student, error: studentError } = await ctx.supabase
      .from('students')
      .select('class_id')
      .eq('id', ctx.user.id)
      .single();

    if (studentError || !student) {
      throw ApiError.notFound('Student profile');
    }

    const classId = student.class_id as string;

    const { data, error, count } = await ctx.supabase
      .from('assignments')
      .select(ASSIGNMENT_SELECT, { count: 'exact' })
      .or(`student_id.eq.${ctx.user.id},class_id.eq.${classId}`)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new ApiError('INTERNAL_ERROR', error.message);
    }

    const rows = parseRows(
      (data ?? []).map(camelCaseKeys),
      assignmentRowSchema,
      'GET /api/v1/assignments[student]',
    );
    const meta = buildMeta(pagination, count ?? 0);
    return paginated(rows, meta);
  }

  const meta = buildMeta(pagination, 0);
  return paginated([], meta);
});

/* ------------------------------------------------------------------ */
/*  POST /api/v1/assignments — create an assignment                    */
/* ------------------------------------------------------------------ */

export const POST = handleRoute(async (req) => {
  const ctx = await requireRole('teacher');
  const body = await parseBody(req, createAssignmentSchema);
  const { assignments } = await createTeacherAssignment(ctx.supabase, ctx.user.id, body);
  return created(assignments.length === 1 ? assignments[0] : assignments);
});
