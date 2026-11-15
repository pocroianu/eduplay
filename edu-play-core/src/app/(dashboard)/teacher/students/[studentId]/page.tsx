import { getActivityProgress, summarizeActivityProgress, getActivityStreak } from '@/features/activities/server'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { StudentDetailContent } from '@/features/teacher-dashboard'
import { ROUTES } from '@/shared/lib/constants'
import { Button } from '@/shared/components/ui/kit'
import { Icon } from '@/shared/components/ui/Icon'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
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

  // Get student record
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single()

  if (!student) {
    notFound()
  }

  // Fetch profile separately to avoid ambiguous FK (students.id AND students.parent_id both reference profiles.id)
  const { data: studentProfile } = await supabase
    .from('profiles')
    .select('full_name, email, avatar_url, date_of_birth')
    .eq('id', studentId)
    .single()

  // Get class info
  const { data: classInfo } = student.class_id
    ? await supabase.from('classes').select('id, name').eq('id', student.class_id).single()
    : { data: null }

  // Verify teacher has access to this student
  if (classInfo) {
    const { data: teacherClass } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classInfo.id)
      .eq('teacher_id', user.id)
      .single()

    if (!teacherClass) {
      notFound()
    }
  }

  const progress = await getActivityProgress(supabase, studentId)

  const streakDays = await getActivityStreak(supabase, studentId)

  const profileData = studentProfile as { full_name: string; email: string; avatar_url: string | null } | null
  const classData = classInfo as { id: string; name: string } | null

  const summary = summarizeActivityProgress(progress)

  const formattedProgress = (progress || []).map(p => ({
    id: p.id,
    status: p.status ?? 'not_started',
    score: p.score,
    time_spent: p.time_spent,
    attempts: p.attempts ?? 0,
    last_played_at: p.last_played_at,
    games: p.activities
      ? {
          title: (p.activities as { title: string }).title,
          category: (p.activities as { category: string | null }).category ?? 'general',
          difficulty_level: 1,
        }
      : null
  }))

  return (
    <>
      <StudentDetailContent
        profile={{
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          role: profile.role,
          avatar_url: profile.avatar_url,
        }}
        student={{
          id: student.id,
          username: student.username,
          fullName: profileData?.full_name || null,
          avatarUrl: profileData?.avatar_url || null,
          className: classData?.name || null,
        }}
        stats={{
          completedGames: summary.completedCount,
          totalGames: summary.activityCount,
          averageScore: summary.averageScore,
          totalTime: summary.totalSeconds,
          streakDays,
        }}
        progress={formattedProgress}
      />
      <div className="px-6 pb-10 lg:px-10">
        <Button
          href={ROUTES.TEACHER.STUDENT_PORTFOLIO(studentId)}
          variant="secondary"
        >
          <Icon name="ClipboardText" size="sm" aria-hidden />
          Vezi portofoliul
        </Button>
      </div>
    </>
  )
}
