import type { SupabaseClient } from '@supabase/supabase-js'
import { EMPTY_CLASS_ID } from './types'

export interface TeacherClassSummary {
  id: string
  name: string
  grade_level: string | null
  is_active: boolean
}

export interface TeacherClassesResult {
  classCount: number
  classIds: string[]
  classNameMap: Map<string, string>
  classes: TeacherClassSummary[]
  scopedClassIds: string[]
}

export async function getTeacherClasses(
  supabase: SupabaseClient,
  teacherId: string,
): Promise<TeacherClassesResult> {
  const [{ count: classCount }, { data: classes }] = await Promise.all([
    supabase
      .from('classes')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', teacherId),
    supabase
      .from('classes')
      .select('id, name, grade_level, is_active')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false }),
  ])

  const classIds = classes?.map((entry) => entry.id) || []
  const classNameMap = new Map(classes?.map((c) => [c.id, c.name]) || [])
  const scopedClassIds = classIds.length > 0 ? classIds : [EMPTY_CLASS_ID]

  return {
    classCount: classCount || 0,
    classIds,
    classNameMap,
    classes: classes || [],
    scopedClassIds,
  }
}
