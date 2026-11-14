import type { SupabaseClient } from '@supabase/supabase-js'

export interface AssignmentRow {
  id: string
  teacher_id: string
  activity_id: string
  version_id: string
  class_id: string | null
  student_id: string | null
  due_date: string | null
  is_mandatory: boolean | null
  created_at: string | null
  updated_at: string | null
  activity: {
    id: string
    title: string | null
    category: string | null
    difficulty: string | null
    thumbnail_url: string | null
  } | null
  class: {
    id: string
    name: string
  } | null
  student: {
    id: string
    username: string
    display_name: string | null
  } | null
}

export interface TeacherAssignmentsResult {
  assignments: AssignmentRow[]
  totalCount: number
}

const ASSIGNMENT_SELECT = `
  *,
  activity:activities!assignments_activity_id_fkey(id, title, category, difficulty, thumbnail_url),
  class:classes!assignments_class_id_fkey(id, name),
  student:students!assignments_student_id_fkey(id, username, display_name)
`

export async function getTeacherAssignments(
  supabase: SupabaseClient,
  teacherId: string,
): Promise<TeacherAssignmentsResult> {
  const { data, count } = await supabase
    .from('assignments')
    .select(ASSIGNMENT_SELECT, { count: 'exact' })
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  return {
    assignments: (data as AssignmentRow[] | null) ?? [],
    totalCount: count ?? 0,
  }
}

export async function getAssignmentById(
  supabase: SupabaseClient,
  assignmentId: string,
  teacherId: string,
): Promise<AssignmentRow | null> {
  const { data } = await supabase
    .from('assignments')
    .select(ASSIGNMENT_SELECT)
    .eq('id', assignmentId)
    .eq('teacher_id', teacherId)
    .single()

  return (data as AssignmentRow | null) ?? null
}
