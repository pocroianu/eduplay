import { getActivityStreak } from '@/features/activities/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/shared/lib/constants/routes'
import { getStudentReportProgress } from '@/features/reports/server'
import { StudentReport } from '@/features/reports'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function objectValue<T extends object>(value: unknown): T | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null
  return value as T
}

function textOrFallback(value: string | null | undefined, fallback: string): string {
  return value || fallback
}

async function requireTeacherUser(supabase: SupabaseServerClient) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(ROUTES.AUTH.LOGIN)

  const { data: teacherProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!teacherProfile || teacherProfile.role !== 'teacher') redirect(ROUTES.AUTH.LOGIN)

  return user
}

async function getStudentProfileOrRedirect(
  supabase: SupabaseServerClient,
  studentId: string,
) {
  const { data: studentProfile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', studentId)
    .single()

  if (!studentProfile) redirect(ROUTES.TEACHER.STUDENTS)

  return studentProfile
}

async function getStudentClass(supabase: SupabaseServerClient, studentId: string) {
  const { data: student } = await supabase
    .from('students')
    .select('*, classes:class_id (name)')
    .eq('id', studentId)
    .single()

  return student
}

function studentClassName(student: { classes: unknown } | null): string {
  const classInfo = objectValue<{ name?: string | null }>(student?.classes)
  return textOrFallback(classInfo?.name, 'Fără clasă')
}

export default async function StudentReportPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params
  const supabase = await createClient()
  await requireTeacherUser(supabase)

  const studentProfile = await getStudentProfileOrRedirect(supabase, studentId)
  const student = await getStudentClass(supabase, studentId)
  const { summary, subjectProgress, gameHistory, recentActivity } = await getStudentReportProgress(supabase, studentId)
  const streakDays = await getActivityStreak(supabase, studentId)
  return (
    <StudentReport
      student={{
        id: studentId,
        name: studentProfile.full_name,
        avatarUrl: studentProfile.avatar_url,
        className: studentClassName(student),
        grade: 'Clasă',
      }}
      stats={{
        gamesPlayed: summary.activityCount,
        avgScore: summary.averageScore,
        timeSpentMinutes: summary.totalMinutes,
        streakDays,
      }}
      subjectProgress={subjectProgress}
      recentActivity={recentActivity}
      gameHistory={gameHistory}
    />
  )
}
