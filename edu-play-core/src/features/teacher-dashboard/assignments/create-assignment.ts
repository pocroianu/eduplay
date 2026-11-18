import 'server-only';

import { ApiError, camelCaseKeys, parseRows } from '@/lib/api';
import { assignmentRowSchema, type CreateAssignmentInput } from '@/features/api';
import { resolveLatestPublishedActivityAssignmentTarget } from '@/features/activities/server';
import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;

/** Both teacher entrypoints cross this seam; transport and cache refresh stay outside. */
export async function createTeacherAssignment(client: Client, teacherId: string, input: CreateAssignmentInput) {
  const studentIds = input.studentIds ?? (input.studentId ? [input.studentId] : []);
  const classIds = new Set<string>();
  const { data: classes, error: classesError } = await client.from('classes').select('id').eq('teacher_id', teacherId);
  if (classesError) throw new ApiError('INTERNAL_ERROR', 'Nu am putut verifica clasele.');
  const ownedClassIds = (classes ?? []).map(row => row.id);
  if (studentIds.length && ownedClassIds.length === 0) throw ApiError.forbidden('Nu există clase proprii pentru elevii selectați.');
  if (input.classId) {
    if (!ownedClassIds.includes(input.classId)) throw ApiError.forbidden('Clasa nu îți aparține.');
    classIds.add(input.classId);
  }
  let notificationStudents: Array<{ id: string; class_id: string | null }> = [];
  if (studentIds.length || input.classId) {
    let query = client.from('students').select('id, class_id');
    if (input.classId) query = query.eq('class_id', input.classId);
    else query = query.in('id', studentIds).in('class_id', ownedClassIds);
    const { data, error } = await query;
    if (error) throw new ApiError('INTERNAL_ERROR', 'Nu am putut verifica elevii.');
    notificationStudents = data ?? [];
    if (studentIds.length && notificationStudents.length !== studentIds.length) {
      throw ApiError.forbidden('Elevii selectați nu aparțin claselor tale.');
    }
    for (const student of notificationStudents) if (student.class_id) classIds.add(student.class_id);
  }
  const target = await resolveLatestPublishedActivityAssignmentTarget(client, input.activityId);
  if (!target) throw ApiError.notFound('Activity');
  const targets = input.classId
    ? [{ class_id: input.classId, student_id: null }]
    : studentIds.map(studentId => ({ class_id: null, student_id: studentId }));
  const { data, error } = await client.from('assignments').insert(targets.map(targetRow => ({
    ...targetRow, teacher_id: teacherId, activity_id: target.activityId, version_id: target.versionId,
    due_date: input.dueDate ?? null, is_mandatory: input.isMandatory,
  }))).select();
  if (error || !data?.length) throw new ApiError('INTERNAL_ERROR', 'Nu am putut crea tema.');
  const assignments = parseRows(data.map(camelCaseKeys), assignmentRowSchema, 'Assignment creation');
  const assignmentByStudent = new Map(assignments.filter(row => row.studentId).map(row => [row.studentId, row.id]));

  // Notifications are best effort after commit. Never report a persisted Assignment as failed.
  const notifications = await Promise.allSettled(notificationStudents.map(async student => {
    const assignmentId = input.classId ? assignments[0].id : assignmentByStudent.get(student.id)!;
    const result = await client.rpc('notify_linked_parents', {
      p_student_id: student.id, p_type: 'assignment_due', p_title: 'Temă nouă',
      p_message: `Copilul tău a primit o temă nouă: ${target.title}`,
      p_data: JSON.stringify({ assignment_id: assignmentId, activity_id: target.activityId,
        version_id: target.versionId, due_date: input.dueDate ?? null }),
    });
    if (result.error) throw new Error('Parent notification failed');
  }));
  if (notifications.some(result => result.status === 'rejected')) console.error('Some Assignment notifications failed');
  return { assignments, classIds: [...classIds] };
}
