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
  assertTeacherOwnsClass,
  assertTeacherOwnsStudent,
  ApiError,
} from '@/lib/api';
import {
  assignmentRowSchema,
  createAssignmentSchema,
} from '@/features/api';
import {
  resolveLatestPublishedActivityAssignmentTarget,
} from '@/features/activities/server';
import type { CreateAssignmentInput } from '@/features/api';

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

  const studentIds = getAssignmentStudentIds(body);

  if (body.classId) {
    await assertTeacherOwnsClass(ctx.supabase, ctx.user.id, body.classId);
  }

  await Promise.all(
    studentIds.map((studentId) =>
      assertTeacherOwnsStudent(ctx.supabase, ctx.user.id, studentId),
    ),
  );

  const target = await resolveAssignmentTarget(ctx.supabase, body);
  const insertTargets = body.classId
    ? [{ class_id: body.classId, student_id: null }]
    : studentIds.map((studentId) => ({ class_id: null, student_id: studentId }));

  const { data, error } = await ctx.supabase
    .from('assignments')
    .insert(insertTargets.map((insertTarget) => ({
      teacher_id: ctx.user.id,
      class_id: insertTarget.class_id,
      student_id: insertTarget.student_id,
      due_date: body.dueDate ?? null,
      is_mandatory: body.isMandatory ?? false,
      activity_id: target.activityId,
      version_id: target.versionId,
    })))
    .select();

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  const rows = parseRows(
    (data ?? []).map(camelCaseKeys),
    assignmentRowSchema,
    'POST /api/v1/assignments',
  );
  const assignmentIdsByStudent = new Map(
    rows
      .filter((row) => row.studentId)
      .map((row) => [row.studentId as string, row.id]),
  );
  const classAssignmentId = rows[0]?.id;

  const notifyStudent = async (studentId: string, assignmentId: string) => {
    await ctx.supabase.rpc('notify_linked_parents', {
      p_student_id: studentId,
      p_type: 'assignment_due',
      p_title: 'Temă nouă',
      p_message: `Copilul tău a primit o temă nouă: ${target.title}`,
      p_data: JSON.stringify({
        assignment_id: assignmentId,
        activity_id: target.activityId,
        version_id: target.versionId,
        due_date: body.dueDate ?? null,
      }),
    });
  };

  try {
    if (studentIds.length > 0) {
      await Promise.all(
        studentIds.map((studentId) =>
          notifyStudent(studentId, assignmentIdsByStudent.get(studentId) ?? classAssignmentId),
        ),
      );
    } else if (body.classId && classAssignmentId) {
      const { data: classStudents } = await ctx.supabase
        .from('students')
        .select('id')
        .eq('class_id', body.classId);

      if (classStudents) {
        await Promise.all(classStudents.map((s) => notifyStudent(s.id, classAssignmentId)));
      }
    }
  } catch (notifyError) {
    console.error('Failed to send parent notifications:', notifyError);
  }

  return created(rows.length === 1 ? rows[0] : rows);
});

function getAssignmentStudentIds(body: CreateAssignmentInput) {
  return body.studentIds ?? (body.studentId ? [body.studentId] : []);
}

async function resolveAssignmentTarget(
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'],
  body: CreateAssignmentInput,
) {
  const target = await resolveLatestPublishedActivityAssignmentTarget(
    supabase,
    body.activityId,
  );

  if (!target) {
    throw ApiError.notFound('Activity');
  }

  return target;
}
