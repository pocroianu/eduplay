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

  // Get canonical Activity Progress
  const { data: progress } = await supabase
    .from('activity_progress')
    .select(`
      *,
      activities:activity_id (title, category, difficulty)
    `)
    .eq('student_id', studentId)
    .order('last_played_at', { ascending: false })

  const profileData = studentProfile as { full_name: string; email: string; avatar_url: string | null } | null
  const classData = classInfo as { id: string; name: string } | null

  const completedGames = progress?.filter(p => p.status === 'completed').length || 0
  const totalGames = progress?.length || 0
  const averageScore = progress?.length
    ? Math.round(progress.reduce((acc, p) => acc + (p.score || 0), 0) / progress.length)
    : 0
  const totalTime = progress?.reduce((acc, p) => acc + (p.time_spent || 0), 0) || 0

  const formattedProgress = (progress || []).map(p => ({
    id: p.id,
    status: p.status,
    score: p.score,
    time_spent: p.time_spent,
    attempts: p.attempts,
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
          completedGames,
          totalGames,
          averageScore,
          totalTime,
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
