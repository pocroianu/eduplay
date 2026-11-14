import type { createClient } from '@/lib/supabase/server';

type TeacherPathSupabase = Awaited<ReturnType<typeof createClient>>;

function countStepRowsByPath(rows: Array<{ path_id: string }>) {
  return rows.reduce((counts, row) => {
    counts.set(row.path_id, (counts.get(row.path_id) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

export async function getTeacherPathAssignmentOptions(
  supabase: TeacherPathSupabase,
  teacherId: string,
) {
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name')
    .eq('teacher_id', teacherId)
    .order('name', { ascending: true });
  const classOptions = classes ?? [];
  const classIds = classOptions.map((entry) => entry.id);
  const { data: students } =
    classIds.length > 0
      ? await supabase
          .from('students')
          .select(
            `id, username, class_id,
            profile:profiles!students_id_fkey(full_name)`,
          )
          .in('class_id', classIds)
          .order('username', { ascending: true })
      : { data: [] };

  const studentOptions = (students ?? []).map((student) => {
    const profile = Array.isArray(student.profile)
      ? student.profile[0]
      : student.profile;

    return {
      id: student.id,
      username: student.username,
      fullName: profile?.full_name ?? null,
      classId: student.class_id,
    };
  });

  return { classOptions, studentOptions };
}

export async function getStepCountByPath(
  supabase: TeacherPathSupabase,
  pathIds: string[],
) {
  if (pathIds.length === 0) {
    return new Map<string, number>();
  }

  const { data: stepRows } = await supabase
    .from('learning_path_steps')
    .select('path_id')
    .in('path_id', pathIds);

  return countStepRowsByPath(stepRows ?? []);
}
