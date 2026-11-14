import {
  handleRoute,
  requireRole,
  parsePagination,
  toRange,
  buildMeta,
  parseBody,
  parseQuery,
  parseRow,
  parseRows,

  created,
  paginated,
  camelCaseKeys,
  snakeCaseKeys,
  assertTeacherOwnsClass,
  getScopedClassIds,
  ApiError,
} from '@/lib/api';
import {
  createStudentSchema,
  listStudentsQuerySchema,
  studentRowSchema,
} from '@/features/api/schemas/student.schema';
import { createAdminClient } from '@/lib/supabase/server';
import { studentPinToAuthPassword } from '@/features/auth/server';

/* ------------------------------------------------------------------ */
/*  GET /api/v1/students — list teacher's students (paginated)        */
/* ------------------------------------------------------------------ */

export const GET = handleRoute(async (req) => {
  const ctx = await requireRole('teacher');
  const { searchParams } = new URL(req.url);
  const query = parseQuery(searchParams, listStudentsQuerySchema);
  const pagination = parsePagination(searchParams);
  const { from, to } = toRange(pagination);

  const scope = await getScopedClassIds(
    ctx.supabase,
    { id: ctx.user.id, role: ctx.profile.role },
    { requestedClassId: query.classId },
  );

  if (scope.unsupportedRole || scope.classIds.length === 0) {
    return paginated([], buildMeta(pagination, 0));
  }

  // Fetch students in teacher's classes, paginated
  const { data: students, error, count } = await ctx.supabase
    .from('students')
    .select('*', { count: 'exact' })
    .in('class_id', scope.classIds)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  const studentList = students ?? [];
  const studentIds = studentList.map((s) => s.id);

  // Fetch profiles in parallel (only if there are students)
  const { data: profiles } = studentIds.length > 0
    ? await ctx.supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', studentIds)
    : { data: [] as { id: string; full_name: string; email: string; avatar_url: string | null }[] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const merged = studentList.map((s) => {
    const profile = profileMap.get(s.id);
    return camelCaseKeys({
      ...s,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      profile_avatar_url: profile?.avatar_url ?? null,
    });
  });

  const rows = parseRows(merged, studentRowSchema, 'GET /api/v1/students');

  const meta = buildMeta(pagination, count ?? 0);
  return paginated(rows, meta);
});

/* ------------------------------------------------------------------ */
/*  POST /api/v1/students — create a new student                     */
/* ------------------------------------------------------------------ */

export const POST = handleRoute(async (req) => {
  const ctx = await requireRole('teacher');
  const body = await parseBody(req, createStudentSchema);
  const adminSupabase = createAdminClient();

  if (body.classId) {
    await assertTeacherOwnsClass(ctx.supabase, ctx.user.id, body.classId);
  }

  // Create auth user via admin client (bypasses email confirmation)
  const email = `${body.username}@student.eduplay.ro`;
  const { data: authData, error: authError } =
    await adminSupabase.auth.admin.createUser({
      email,
      password: studentPinToAuthPassword(body.password),
      email_confirm: true,
      user_metadata: {
        full_name: body.fullName,
        role: 'student',
      },
    });

  if (authError || !authData.user) {
    throw new ApiError('INTERNAL_ERROR', authError?.message ?? 'Failed to create auth user');
  }

  const userId = authData.user.id;

  // Insert student record
  const { data: student, error: studentError } = await adminSupabase
    .from('students')
    .insert(
      snakeCaseKeys<Record<string, unknown>>({
        id: userId,
        classId: body.classId ?? null,
        username: body.username,
      }),
    )
    .select()
    .single();

  if (studentError) {
    // Clean up: delete the auth user on failure
    await adminSupabase.auth.admin.deleteUser(userId);
    throw new ApiError('INTERNAL_ERROR', studentError.message);
  }

  // CRITICAL SECURITY: Do NOT return password in response
  const row = parseRow(
    camelCaseKeys({
      id: student.id,
      username: student.username,
      class_id: student.class_id,
      created_at: student.created_at,
      full_name: body.fullName,
    }),
    studentRowSchema,
    'POST /api/v1/students',
  );
  return created(row);
});
