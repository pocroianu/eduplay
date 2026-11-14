import {
  handleRoute,
  requireRole,
  parseBody,
  parseRow,
  success,
  noContent,
  camelCaseKeys,
  snakeCaseKeys,
  assertTeacherOwnsClass,
  assertTeacherOwnsStudent,
  ApiError,
} from '@/lib/api';
import {
  studentRowSchema,
  updateStudentSchema,
} from '@/features/api/schemas/student.schema';
import { createAdminClient } from '@/lib/supabase/server';

/* ------------------------------------------------------------------ */
/*  GET /api/v1/students/:id — get a single student                  */
/* ------------------------------------------------------------------ */

export const GET = handleRoute(async (req, context) => {
  const { id } = await context!.params;
  const ctx = await requireRole('teacher');

  const student = await assertTeacherOwnsStudent<Record<string, unknown>>(
    ctx.supabase,
    ctx.user.id,
    id,
    { select: '*' },
  );

  // Fetch profile for additional data
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('id', id)
    .single();

  const row = parseRow(
    camelCaseKeys({
      ...student,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      profile_avatar_url: profile?.avatar_url ?? null,
    }),
    studentRowSchema,
    'GET /api/v1/students/[id]',
  );
  return success(row);
});

/* ------------------------------------------------------------------ */
/*  PATCH /api/v1/students/:id — update a student                    */
/* ------------------------------------------------------------------ */

export const PATCH = handleRoute(async (req, context) => {
  const { id } = await context!.params;
  const ctx = await requireRole('teacher');
  const body = await parseBody(req, updateStudentSchema);

  await assertTeacherOwnsStudent(ctx.supabase, ctx.user.id, id);

  if (body.classId !== undefined && body.classId !== null) {
    await assertTeacherOwnsClass(ctx.supabase, ctx.user.id, body.classId);
  }

  const adminSupabase = createAdminClient();

  // Build student update payload (exclude fullName — that goes to profiles)
  const { fullName, ...studentFields } = body;
  const hasStudentUpdates = Object.keys(studentFields).length > 0;

  // Update student record and profile in parallel
  const updates: Promise<unknown>[] = [];

  if (hasStudentUpdates) {
    updates.push(
      Promise.resolve(
        adminSupabase
          .from('students')
          .update(snakeCaseKeys(studentFields))
          .eq('id', id),
      ).then(({ error }) => {
        if (error) throw new ApiError('INTERNAL_ERROR', error.message);
      }),
    );
  }

  if (fullName !== undefined) {
    updates.push(
      Promise.resolve(
        adminSupabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('id', id),
      ).then(({ error }) => {
        if (error) throw new ApiError('INTERNAL_ERROR', error.message);
      }),
    );
  }

  await Promise.all(updates);

  // Fetch updated student + profile
  const [{ data: student }, { data: profile }] = await Promise.all([
    ctx.supabase.from('students').select('*').eq('id', id).single(),
    ctx.supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .eq('id', id)
      .single(),
  ]);

  if (!student) {
    throw ApiError.notFound('Student not found');
  }

  const row = parseRow(
    camelCaseKeys({
      ...student,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      profile_avatar_url: profile?.avatar_url ?? null,
    }),
    studentRowSchema,
    'PATCH /api/v1/students/[id]',
  );
  return success(row);
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/v1/students/:id — delete a student                   */
/* ------------------------------------------------------------------ */

export const DELETE = handleRoute(async (req, context) => {
  const { id } = await context!.params;
  const ctx = await requireRole('teacher');

  await assertTeacherOwnsStudent(ctx.supabase, ctx.user.id, id);

  // Delete via admin — cascades to student record and profile
  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.auth.admin.deleteUser(id);

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  return noContent();
});
