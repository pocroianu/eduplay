'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createAssignmentSchema,
  updateAssignmentSchema,
} from '@/features/api/schemas/assignment.schema'
import { createTeacherAssignment } from '../assignments/create-assignment'
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

export async function createAssignment(input: unknown): Promise<AssignmentActionResult> {
  const parsed = createAssignmentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Date invalide' }
  const auth = await getTeacherUser()
  if (!auth) return { success: false, error: 'Nu sunteți autentificat ca profesor' }
  let result: Awaited<ReturnType<typeof createTeacherAssignment>>
  try {
    result = await createTeacherAssignment(auth.supabase, auth.userId, parsed.data)
  } catch {
    return { success: false, error: 'Nu am putut crea tema. Verifică activitatea și elevii selectați.' }
  }
  revalidatePath(ROUTES.TEACHER.ASSIGNMENTS)
  for (const classId of result.classIds) revalidatePath(ROUTES.TEACHER.CLASS(classId))
  const ids = result.assignments.map(row => row.id)
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
