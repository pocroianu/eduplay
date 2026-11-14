import {
  handleRoute,
  requireAuth,
  success,
  camelCaseKeys,
  ApiError,
} from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  GET /api/v1/data-export/me                                        */
/*  GDPR Art.15/20 — personal data export for the current user.       */
/*  Returns role-appropriate data as JSON.                             */
/* ------------------------------------------------------------------ */

export const GET = handleRoute(async () => {
  const ctx = await requireAuth();
  const { role } = ctx.profile;
  const userId = ctx.user.id;

  const profile = {
    id: ctx.profile.id,
    email: ctx.user.email,
    fullName: ctx.profile.full_name,
    role,
  };

  if (role === 'teacher') {
    return success(await exportTeacherData(ctx, userId, profile));
  }

  if (role === 'parent') {
    return success(await exportParentData(ctx, userId, profile));
  }

  if (role === 'student') {
    return success(await exportStudentData(ctx, userId, profile));
  }

  if (role === 'admin') {
    // Admin accounts have no personal learning data beyond the profile itself.
    return success({
      exportedAt: new Date().toISOString(),
      exportType: 'user' as const,
      profile,
    });
  }

  // Unknown role — fail loud so new roles can't silently leak only the profile.
  throw ApiError.forbidden(`Data export not supported for role: ${role}`);
});

type Ctx = Awaited<ReturnType<typeof requireAuth>>;
type Profile = { id: string; email: string; fullName: string; role: string };

async function exportTeacherData(ctx: Ctx, userId: string, profile: Profile) {
  const { data: classes } = await ctx.supabase
    .from('classes')
    .select('id, name, description, grade_level, school_year, is_active, created_at')
    .eq('teacher_id', userId);

  const classIds = (classes ?? []).map((c) => c.id);

  const { data: students } =
    classIds.length > 0
      ? await ctx.supabase
          .from('students')
          .select('id, username, class_id, avatar_url, created_at')
          .in('class_id', classIds)
      : { data: [] as never[] };

  return {
    exportedAt: new Date().toISOString(),
    exportType: 'user' as const,
    profile,
    classes: (classes ?? []).map(camelCaseKeys),
    students: (students ?? []).map(camelCaseKeys),
  };
}

async function exportParentData(ctx: Ctx, userId: string, profile: Profile) {
  const { data: links } = await ctx.supabase
    .from('parent_children')
    .select('student_id, relationship_type, linked_at')
    .eq('parent_id', userId)
    .eq('status', 'active');

  const childIds = (links ?? []).map((l) => l.student_id);

  const [
    childrenResult,
    activityProgressResult,
    notificationsResult,
  ] = await Promise.all([
    childIds.length > 0
      ? ctx.supabase
          .from('students')
          .select('id, username, class_id, avatar_url, created_at')
          .in('id', childIds)
      : Promise.resolve({ data: [] as never[] }),
    childIds.length > 0
      ? ctx.supabase
          .from('activity_progress')
          .select(
            'id, student_id, activity_id, last_version_id, status, score, time_spent, attempts, completed_at, created_at',
          )
          .in('student_id', childIds)
      : Promise.resolve({ data: [] as never[] }),
    ctx.supabase
      .from('parent_notifications')
      .select('id, student_id, type, title, message, created_at')
      .eq('parent_id', userId),
  ]);

  const activityProgressByChild = groupRowsByStudent(
    activityProgressResult.data ?? [],
  );

  return {
    exportedAt: new Date().toISOString(),
    exportType: 'user' as const,
    profile,
    familyLinks: (links ?? []).map(camelCaseKeys),
    children: (childrenResult.data ?? []).map((s) => ({
      ...camelCaseKeys<Record<string, unknown>>(s),
      activityProgress:
        activityProgressByChild.get((s as { id: string }).id) ?? [],
    })),
    notifications: (notificationsResult.data ?? []).map(camelCaseKeys),
  };
}

async function exportStudentData(ctx: Ctx, userId: string, profile: Profile) {
  const [
    studentResult,
    activityProgressResult,
    assignmentsResult,
  ] = await Promise.all([
    ctx.supabase
      .from('students')
      .select('id, username, class_id, avatar_url, created_at')
      .eq('id', userId)
      .maybeSingle(),
    ctx.supabase
      .from('activity_progress')
      .select(
        'id, activity_id, last_version_id, status, score, time_spent, attempts, completed_at, created_at',
      )
      .eq('student_id', userId),
    ctx.supabase
      .from('assignments')
      .select('id, activity_id, version_id, due_date, is_mandatory, created_at')
      .eq('student_id', userId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    exportType: 'user' as const,
    profile,
    studentDetails: studentResult.data
      ? camelCaseKeys(studentResult.data)
      : null,
    activityProgress: (activityProgressResult.data ?? []).map(camelCaseKeys),
    assignments: (assignmentsResult.data ?? []).map(camelCaseKeys),
  };
}

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
