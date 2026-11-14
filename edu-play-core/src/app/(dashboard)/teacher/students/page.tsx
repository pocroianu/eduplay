import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StudentsPageContent } from '@/features/teacher-dashboard'
import { ROUTES } from '@/shared/lib/constants'

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN)
  }

  // Get all classes for this teacher
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name')
    .eq('teacher_id', user.id)

  const classMap = classes?.reduce((acc, c) => {
    acc[c.id] = c.name
    return acc
  }, {} as Record<string, string>) || {}

  // Get all students - for MVP, show all students the teacher can see
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch profiles and Activity Progress in parallel to avoid ambiguous FK issue
  const studentIds = students?.map(s => s.id) || []
  const [profilesResult, progressResult] = studentIds.length > 0
    ? await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', studentIds),
        supabase
          .from('activity_progress')
          .select('student_id, status, last_played_at')
          .in('student_id', studentIds),
      ])
    : [{ data: [] }, { data: [] }]

  const profileMap = (profilesResult.data || []).reduce((acc, p) => {
    acc[p.id] = p
    return acc
  }, {} as Record<string, { full_name: string; email: string; avatar_url: string | null }>)

  const progressByStudent = (progressResult.data || []).reduce((acc, row) => {
    const list = acc[row.student_id] || (acc[row.student_id] = [])
    list.push(row)
    return acc
  }, {} as Record<string, { status: string | null; last_played_at: string | null }[]>)

  const ACTIVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
  const now = new Date().getTime()

  const formattedStudents = (students || []).map(s => {
    const entries = progressByStudent[s.id] || []
    const total = entries.length
    const completed = entries.filter((e) => e.status === 'completed').length
    const lastTimestamp = entries.reduce<number>((max, e) => {
      const t = e.last_played_at ? new Date(e.last_played_at).getTime() : 0
      return t > max ? t : max
    }, 0)
    const lastActiveAt = lastTimestamp > 0 ? new Date(lastTimestamp).toISOString() : null
    const isActive = lastTimestamp > 0 && now - lastTimestamp <= ACTIVE_WINDOW_MS
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0

    return {
      id: s.id,
      username: s.username,
      class_id: s.class_id,
      profiles: profileMap[s.id] || null,
      isActive,
      progressPercent,
      lastActiveAt,
    }
  })

  return (
    <StudentsPageContent
      profile={{
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        avatar_url: profile.avatar_url,
      }}
      students={formattedStudents}
      classMap={classMap}
    />
  )
}
