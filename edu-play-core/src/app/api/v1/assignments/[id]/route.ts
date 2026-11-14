import {
  handleRoute,
  requireAuth,
  requireRole,
  parseBody,
  parseRow,
  success,
  noContent,
  camelCaseKeys,
  snakeCaseKeys,
  ApiError,
} from '@/lib/api';
import {
  assignmentRowSchema,
  updateAssignmentSchema,
} from '@/features/api/schemas/assignment.schema';

/* ------------------------------------------------------------------ */
/*  GET /api/v1/assignments/:id — get a single assignment              */
/* ------------------------------------------------------------------ */

export const GET = handleRoute(async (req, context) => {
  const { id } = await context!.params;
  const ctx = await requireAuth();

  const { data, error } = await ctx.supabase
    .from('assignments')
    .select('*, activities:activity_id (title, category, difficulty, thumbnail_url)')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw ApiError.notFound('Assignment not found');
  }

  // Scope check: teacher must own, student must be target
  const role = ctx.profile.role;

  if (role === 'teacher' && data.teacher_id !== ctx.user.id) {
    throw ApiError.notFound('Assignment not found');
  }

  if (role === 'student') {
    // Check if student is directly assigned or in the assigned class
    let hasAccess = data.student_id === ctx.user.id;

    if (!hasAccess && data.class_id) {
      const { data: student } = await ctx.supabase
        .from('students')
        .select('class_id')
        .eq('id', ctx.user.id)
        .single();

      hasAccess = student?.class_id === data.class_id;
    }

    if (!hasAccess) {
      throw ApiError.notFound('Assignment not found');
    }
  }

  const row = parseRow(camelCaseKeys(data), assignmentRowSchema, 'GET /api/v1/assignments/[id]');
  return success(row);
});

/* ------------------------------------------------------------------ */
/*  PATCH /api/v1/assignments/:id — update an assignment               */
/* ------------------------------------------------------------------ */

export const PATCH = handleRoute(async (req, context) => {
  const { id } = await context!.params;
  const ctx = await requireRole('teacher');
  const body = await parseBody(req, updateAssignmentSchema);

  const { data, error } = await ctx.supabase
    .from('assignments')
    .update(snakeCaseKeys(body))
    .eq('id', id)
    .eq('teacher_id', ctx.user.id)
    .select()
    .single();

  if (error || !data) {
    throw ApiError.notFound('Assignment not found');
  }

  const row = parseRow(camelCaseKeys(data), assignmentRowSchema, 'PATCH /api/v1/assignments/[id]');
  return success(row);
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/v1/assignments/:id — delete an assignment               */
/* ------------------------------------------------------------------ */

export const DELETE = handleRoute(async (req, context) => {
  const { id } = await context!.params;
  const ctx = await requireRole('teacher');

  const { error } = await ctx.supabase
    .from('assignments')
    .delete()
    .eq('id', id)
    .eq('teacher_id', ctx.user.id);

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  return noContent();
});
