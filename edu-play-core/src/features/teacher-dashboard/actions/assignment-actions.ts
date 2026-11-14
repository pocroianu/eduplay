'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  type CreateAssignmentInput,
} from '@/features/api/schemas/assignment.schema'
import {
  resolveLatestPublishedActivityAssignmentTarget,
} from '@/features/activities/server'
import { ROUTES } from '@/shared/lib/constants'

export interface AssignmentActionResult {
  success: boolean
  error?: string
  data?: { id: string; ids?: string[] }
}

async function getTeacherUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') return null
  return { supabase, userId: user.id }
}

function getAssignmentStudentIds(input: CreateAssignmentInput) {
  return input.studentIds ?? (input.studentId ? [input.studentId] : [])
}

export async function createAssignment(
  input: unknown,
): Promise<AssignmentActionResult> {
  const parsed = createAssignmentSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Date invalide' }
  }

  const auth = await getTeacherUser()
  if (!auth) {
    return { success: false, error: 'Nu sunteți autentificat ca profesor' }
  }

  const { supabase, userId } = auth
  const assignmentInput = parsed.data as CreateAssignmentInput
  const { activityId, classId, dueDate, isMandatory } = assignmentInput
  const studentIds = getAssignmentStudentIds(assignmentInput)
  const classIdsToRevalidate = new Set<string>()

  if (classId) {
    const { data: classData } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('teacher_id', userId)
      .single()
    if (!classData) {
      return { success: false, error: 'Clasa nu a fost găsită sau nu vă aparține' }
    }
    classIdsToRevalidate.add(classId)
  }

  let ownedStudents: Array<{ id: string; class_id: string | null }> = []
  if (studentIds.length > 0) {
    const { data: classes } = await supabase
      .from('classes')
      .select('id')
      .eq('teacher_id', userId)
    const teacherClassIds = (classes ?? []).map((cls) => cls.id)

    if (teacherClassIds.length === 0) {
      return { success: false, error: 'Elevii selectați nu aparțin unei clase pe care o gestionați' }
    }

    const { data: students } = await supabase
      .from('students')
      .select('id, class_id')
      .in('id', studentIds)
      .in('class_id', teacherClassIds)

    ownedStudents = students ?? []
    if (ownedStudents.length !== studentIds.length) {
      return { success: false, error: 'Elevii selectați nu aparțin unei clase pe care o gestionați' }
    }

    for (const student of ownedStudents) {
      if (student.class_id) classIdsToRevalidate.add(student.class_id)
    }
  }

  const target = await resolveLatestPublishedActivityAssignmentTarget(supabase, activityId)

  if (!target) {
    return { success: false, error: 'Activitatea nu a fost găsită' }
  }

  const rows = classId
    ? [{ class_id: classId, student_id: null }]
    : studentIds.map((studentId) => ({ class_id: null, student_id: studentId }))

  const { data, error } = await supabase
    .from('assignments')
    .insert(rows.map((row) => ({
      teacher_id: userId,
      activity_id: target.activityId,
      version_id: target.versionId,
      class_id: row.class_id,
      student_id: row.student_id,
      due_date: dueDate ?? null,
      is_mandatory: isMandatory ?? false,
    })))
    .select('id')

  if (error || !data?.length) {
    console.error('createAssignment error:', error)
    return { success: false, error: 'Eroare la crearea temei' }
  }

  revalidatePath(ROUTES.TEACHER.ASSIGNMENTS)
  for (const revalidateClassId of classIdsToRevalidate) {
    revalidatePath(ROUTES.TEACHER.CLASS(revalidateClassId))
  }

  const ids = data.map((assignment) => assignment.id)
  return { success: true, data: { id: ids[0], ids } }
}

export async function updateAssignment(
  assignmentId: string,
  input: unknown,
): Promise<AssignmentActionResult> {
  const parsed = updateAssignmentSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Date invalide' }
  }

  const auth = await getTeacherUser()
  if (!auth) {
    return { success: false, error: 'Nu sunteți autentificat ca profesor' }
  }

  const { supabase, userId } = auth

  const updateData: Record<string, unknown> = {}
  if (parsed.data.dueDate !== undefined) updateData.due_date = parsed.data.dueDate
  if (parsed.data.isMandatory !== undefined) updateData.is_mandatory = parsed.data.isMandatory

  const { error } = await supabase
    .from('assignments')
    .update(updateData)
    .eq('id', assignmentId)
    .eq('teacher_id', userId)

  if (error) {
    console.error('updateAssignment error:', error)
    return { success: false, error: 'Eroare la actualizarea temei' }
  }

  revalidatePath(ROUTES.TEACHER.ASSIGNMENTS)
  return { success: true, data: { id: assignmentId } }
}

export async function deleteAssignment(
  assignmentId: string,
): Promise<AssignmentActionResult> {
  const auth = await getTeacherUser()
  if (!auth) {
    return { success: false, error: 'Nu sunteți autentificat ca profesor' }
  }

  const { supabase, userId } = auth

  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', assignmentId)
    .eq('teacher_id', userId)

  if (error) {
    console.error('deleteAssignment error:', error)
    return { success: false, error: 'Eroare la ștergerea temei' }
  }

  revalidatePath(ROUTES.TEACHER.ASSIGNMENTS)
  return { success: true, data: { id: assignmentId } }
}
