import {
  handleRoute,
  requireRole,
  parsePagination,
  toRange,
  buildMeta,
  parseRows,
  paginated,
  camelCaseKeys,
  assertTeacherOwnsClass,
  ApiError,
} from '@/lib/api';
import { studentRowSchema } from '@/features/api/schemas/student.schema';

/* ------------------------------------------------------------------ */
/*  GET /api/v1/classes/:id/students — list students in a class       */
/* ------------------------------------------------------------------ */

export const GET = handleRoute(async (req, context) => {
  const { id: classId } = await context!.params;
  const ctx = await requireRole('teacher');

  await assertTeacherOwnsClass(ctx.supabase, ctx.user.id, classId);

  // Paginated fetch of students
  const { searchParams } = new URL(req.url);
  const pagination = parsePagination(searchParams);
  const { from, to } = toRange(pagination);

  const { data: students, error, count } = await ctx.supabase
    .from('students')
    .select('*', { count: 'exact' })
    .eq('class_id', classId)
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

  const rows = parseRows(merged, studentRowSchema, 'GET /api/v1/classes/[id]/students');

  const meta = buildMeta(pagination, count ?? 0);
  return paginated(rows, meta);
});
