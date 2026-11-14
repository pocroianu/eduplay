import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/shared/lib/constants/routes'
import { StudentReport } from '@/features/reports'

type ProgressRow = {
  id: string
  status: string | null
  score: number | null
  completed_at: string | null
  last_played_at: string | null
  activities: unknown
}

type ActivitySummary = {
  title?: string | null
  category?: string | null
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

const SUBJECT_DEFS = [
  { key: 'math', subject: 'Matematică', shortLabel: 'Mat', color: 'var(--color-primary)' },
  { key: 'romanian', subject: 'Română', shortLabel: 'Rom', color: 'var(--color-coral)' },
  { key: 'science', subject: 'Științe', shortLabel: 'Ști', color: 'var(--color-success)' },
  { key: 'english', subject: 'Engleză', shortLabel: 'Eng', color: 'var(--color-gold)' },
] as const

function activitySummary(row: { activities: unknown }): ActivitySummary | null {
  const activity = row.activities
  if (!activity || Array.isArray(activity) || typeof activity !== 'object') return null
  return activity as ActivitySummary
}

function objectValue<T extends object>(value: unknown): T | null {
  if (!value) return null
  if (Array.isArray(value)) return null
  if (typeof value !== 'object') return null
  return value as T
}

function textOrFallback(value: string | null | undefined, fallback: string): string {
  return value || fallback
}

function firstTimestamp(...values: Array<string | null>): string {
  return values.find(Boolean) ?? new Date().toISOString()
}

function progressScore(row: { score: number | null }): number {
  return row.score ?? 0
}

function averageProgressScore(rows: ReadonlyArray<{ score: number | null }>): number {
  if (rows.length === 0) return 0
  const totalScore = rows.reduce((acc, row) => acc + progressScore(row), 0)
  return Math.round(totalScore / rows.length)
}

function buildSubjectProgress(progressRows: ReadonlyArray<ProgressRow>) {
  return SUBJECT_DEFS.map(({ key, subject, shortLabel, color }) => {
    const subjectGames = progressRows.filter((row) => activitySummary(row)?.category === key)
    return {
      subject,
      shortLabel,
      score: averageProgressScore(subjectGames),
      color,
      hoursSpent: 0,
    }
  })
}

function buildGameHistoryItem(row: ProgressRow) {
  const activity = activitySummary(row)
  return {
    id: row.id,
    gameName: textOrFallback(activity?.title, 'Necunoscut'),
    subject: textOrFallback(activity?.category, 'Altele'),
    score: progressScore(row),
    maxScore: 100,
    completedAt: firstTimestamp(row.completed_at, row.last_played_at),
    duration: '0m',
  }
}

function buildGameHistory(progressRows: ReadonlyArray<ProgressRow>) {
  return progressRows.map(buildGameHistoryItem)
}

function buildRecentActivity(gameHistory: ReturnType<typeof buildGameHistory>) {
  return gameHistory.slice(0, 10).map((game) => ({
    id: game.id,
    title: game.gameName,
    description: `A jucat ${game.gameName}`,
    timestamp: game.completedAt,
    type: 'game' as const,
  }))
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

async function getProgressRows(supabase: SupabaseServerClient, studentId: string) {
  const { data: progress } = await supabase
    .from('activity_progress')
    .select('*, activities:activity_id (title, category)')
    .eq('student_id', studentId)
    .order('last_played_at', { ascending: false })

  return (progress ?? []) as ProgressRow[]
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
  const progressRows = await getProgressRows(supabase, studentId)
  const completedGames = progressRows.filter((row) => row.status === 'completed')
  const avgScore = averageProgressScore(completedGames)
  const subjectProgress = buildSubjectProgress(progressRows)
  const gameHistory = buildGameHistory(progressRows)
  const recentActivity = buildRecentActivity(gameHistory)

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
        gamesPlayed: progressRows.length,
        avgScore,
        timeSpentMinutes: 0,
        streakDays: 0,
      }}
      subjectProgress={subjectProgress}
      recentActivity={recentActivity}
      gameHistory={gameHistory}
    />
  )
}
