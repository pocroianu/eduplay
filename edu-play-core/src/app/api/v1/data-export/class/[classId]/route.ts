import {
  handleRoute,
  requireRole,
  success,
  ApiError,
  camelCaseKeys,
} from '@/lib/api';
import { classExportParamsSchema } from '@/features/api/schemas/data-export.schema';

/* ------------------------------------------------------------------ */
/*  GET /api/v1/data-export/class/[classId]                           */
/*  GDPR Art.15 — class-level data export for the owning teacher.     */
/*  Phase 1 exit criterion (PRIVACY.md §6).                           */
/* ------------------------------------------------------------------ */

export const GET = handleRoute(async (_req, context) => {
  const ctx = await requireRole('teacher');
  const rawParams = await context!.params;

  const parsed = classExportParamsSchema.safeParse(rawParams);
  if (!parsed.success) {
    throw ApiError.validation('Invalid class ID');
  }
  const { classId } = parsed.data;

  const { data: classData, error: classError } = await ctx.supabase
    .from('classes')
    .select(
      'id, name, description, grade_level, school_year, is_active, created_at',
    )
    .eq('id', classId)
    .eq('teacher_id', ctx.user.id)
    .single();

  if (classError || !classData) {
    throw ApiError.notFound('Class');
  }

  const { data: students } = await ctx.supabase
    .from('students')
    .select('id, username, avatar_url, created_at')
    .eq('class_id', classId);

  const studentIds = (students ?? []).map((s) => s.id);

  const [activityProgressResult, assignmentsResult] =
    await Promise.all([
      studentIds.length > 0
        ? ctx.supabase
            .from('activity_progress')
            .select(
              'id, student_id, activity_id, last_version_id, status, score, time_spent, attempts, completed_at, created_at',
            )
            .in('student_id', studentIds)
        : Promise.resolve({ data: [] as never[] }),
      ctx.supabase
        .from('assignments')
        .select(
          'id, activity_id, version_id, student_id, due_date, is_mandatory, created_at',
        )
        .eq('class_id', classId),
    ]);

  const activityProgressByStudent = groupRowsByStudent(
    activityProgressResult.data ?? [],
  );

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    exportType: 'class' as const,
    class: camelCaseKeys(classData),
    students: (students ?? []).map((s) => ({
      ...camelCaseKeys<Record<string, unknown>>(s),
      activityProgress: activityProgressByStudent.get(s.id) ?? [],
    })),
    assignments: (assignmentsResult.data ?? []).map(camelCaseKeys),
  };

  return success(exportPayload);
});

function groupRowsByStudent(rows: readonly unknown[]) {
  const byStudent = new Map<string, unknown[]>();

  for (const row of rows) {
    const sid = (row as { student_id: string }).student_id;
    const list = byStudent.get(sid) ?? [];
    list.push(camelCaseKeys(row));
    byStudent.set(sid, list);
  }

  return byStudent;
}
