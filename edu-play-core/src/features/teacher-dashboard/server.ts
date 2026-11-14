import { createClient } from '@/lib/supabase/server'
import type { TeacherDashboardContentProps } from './components/TeacherDashboardContent'
import {
  getTeacherClasses,
  getClassStudents,
  getTeacherAssignments,
  getAssignmentById,
  buildStudentSummaries,
  buildRecentActivity,
  buildWeeklyActivity,
  buildSubjectSnapshot,
} from './queries'
import type { ProgressRow, AssignmentRow } from './queries'

export async function getTeacherDashboardData(): Promise<TeacherDashboardContentProps | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') return null

  // Step 1: Fetch teacher's classes
  const { classCount, classNameMap, classes, scopedClassIds } = await getTeacherClasses(supabase, user.id)

  // Step 2: Fetch students, profiles, progress, and activity count in parallel
  const [classStudents, gameCountResult] = await Promise.all([
    getClassStudents(supabase, scopedClassIds),
    supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true),
  ])

  const { studentCount, studentRows, profileMap, progressRows, gameMap } = classStudents

  // Step 3: Aggregate stats from raw data
  const studentSummaries = buildStudentSummaries(
    studentRows, profileMap, progressRows, gameMap, classNameMap,
  )
  const recentActivity = buildRecentActivity(progressRows, studentRows, profileMap, gameMap)
  const weeklyActivity = buildWeeklyActivity(progressRows)
  const subjectSnapshot = buildSubjectSnapshot(progressRows, gameMap)

  return {
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      role: profile.role,
      avatar_url: profile.avatar_url,
    },
    stats: {
      studentCount,
      classCount,
      gameCount: gameCountResult.count || 0,
    },
    classes,
    countByClass: studentRows.reduce<Record<string, number>>((counts, student) => {
      if (student.class_id) counts[student.class_id] = (counts[student.class_id] ?? 0) + 1
      return counts
    }, {}),
    studentSummaries,
    recentActivity,
    weeklyActivity,
    subjectSnapshot,
  }
}

// ---------------------------------------------------------------------------
// Class Detail Data
// ---------------------------------------------------------------------------

export type StudentStatus = 'online' | 'needs_help' | 'offline'

export interface ClassDetailStudent {
  id: string
  fullName: string
  username: string
  avatarUrl: string | null
  status: StudentStatus
  recentGameTitle: string | null
  recentGameTime: string | null
  lessonProgress: number
  totalScore: number
}

export interface LeaderboardEntry {
  id: string
  fullName: string
  avatarUrl: string | null
  totalScore: number
}

export interface ClassDetailData {
  profile: {
    id: string
    full_name: string
    email: string
    role: string
    avatar_url: string | null
  }
  classData: {
    id: string
    name: string
    description: string | null
    grade_level: string | null
    school_year: string | null
    is_active: boolean
  }
  stats: {
    totalStudents: number
    activeStudents: number
    lessonsInProgress: number
    awardsToday: number
  }
  studentRoster: ClassDetailStudent[]
  leaderboard: LeaderboardEntry[]
}

export async function getClassDetailData(classId: string): Promise<ClassDetailData | null | 'not-found'> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') return null

  const { data: classData } = await supabase
    .from('classes')
    .select('*')
    .eq('id', classId)
    .eq('teacher_id', user.id)
    .single()

  if (!classData) return 'not-found'

  // Reuse shared query for fetching students + profiles + progress
  const { studentRows, profileMap, progressRows, gameMap } = await getClassStudents(
    supabase,
    [classId],
  )

  // Group progress by student
  const progressByStudent = new Map<string, ProgressRow[]>()
  for (const item of progressRows) {
    const entries = progressByStudent.get(item.student_id) || []
    entries.push(item)
    progressByStudent.set(item.student_id, entries)
  }

  const now = new Date()
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let activeStudents = 0
  let lessonsInProgress = 0
  let awardsToday = 0

  const studentRoster: ClassDetailStudent[] = studentRows.map((student) => {
    const studentProfile = profileMap.get(student.id)
    const entries = progressByStudent.get(student.id) || []

    const completed = entries.filter((e) => e.status === 'completed').length
    const inProgress = entries.filter((e) => e.status === 'in_progress').length
    const totalScore = entries.reduce((sum, e) => sum + (e.score || 0), 0)
    const averageScore = entries.length > 0 ? totalScore / entries.length : 0
    const lessonProgress = entries.length > 0 ? Math.round((completed / entries.length) * 100) : 0

    const mostRecent = entries[0]
    const recentGame = mostRecent ? gameMap.get(mostRecent.game_id) : null

    const lastPlayedAt = mostRecent?.last_played_at ? new Date(mostRecent.last_played_at) : null
    let status: StudentStatus = 'offline'
    if (lastPlayedAt && lastPlayedAt >= fifteenMinutesAgo) {
      status = 'online'
    } else if (averageScore > 0 && averageScore < 40) {
      status = 'needs_help'
    }

    if (lastPlayedAt && lastPlayedAt >= sevenDaysAgo) {
      activeStudents++
    }
    lessonsInProgress += inProgress

    const completedToday = entries.filter((e) => {
      if (e.status !== 'completed' || !e.last_played_at) return false
      return new Date(e.last_played_at) >= todayStart
    }).length
    awardsToday += completedToday

    return {
      id: student.id,
      fullName: studentProfile?.full_name || student.username,
      username: student.username,
      avatarUrl: studentProfile?.avatar_url || null,
      status,
      recentGameTitle: recentGame?.title || null,
      recentGameTime: mostRecent?.last_played_at || null,
      lessonProgress,
      totalScore,
    }
  })

  studentRoster.sort((a, b) => {
    const statusOrder: Record<StudentStatus, number> = { online: 0, needs_help: 1, offline: 2 }
    const diff = statusOrder[a.status] - statusOrder[b.status]
    if (diff !== 0) return diff
    return a.fullName.localeCompare(b.fullName)
  })

  const leaderboard: LeaderboardEntry[] = [...studentRoster]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      fullName: s.fullName,
      avatarUrl: s.avatarUrl,
      totalScore: s.totalScore,
    }))

  return {
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      role: profile.role,
      avatar_url: profile.avatar_url,
    },
    classData: {
      id: classData.id,
      name: classData.name,
      description: classData.description,
      grade_level: classData.grade_level,
      school_year: classData.school_year,
      is_active: classData.is_active,
    },
    stats: {
      totalStudents: studentRows.length,
      activeStudents,
      lessonsInProgress,
      awardsToday,
    },
    studentRoster,
    leaderboard,
  }
}

// ---------------------------------------------------------------------------
// Assignments Data
// ---------------------------------------------------------------------------

export interface AssignmentsPageData {
  profile: {
    id: string
    full_name: string
    email: string
    role: string
    avatar_url: string | null
  }
  assignments: AssignmentRow[]
  totalCount: number
  classes: Array<{ id: string; name: string }>
  activities: Array<{ id: string; title: string | null; category: string | null; thumbnail_url: string | null }>
}

export async function getAssignmentsPageData(): Promise<AssignmentsPageData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') return null

  const [assignmentsResult, { data: classes }, { data: activities }] = await Promise.all([
    getTeacherAssignments(supabase, user.id),
    supabase
      .from('classes')
      .select('id, name')
      .eq('teacher_id', user.id)
      .order('name'),
    supabase
      .from('activities')
      .select('id, title, category, thumbnail_url')
      .eq('status', 'published')
      .eq('is_published', true)
      .order('title'),
  ])

  return {
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      role: profile.role,
      avatar_url: profile.avatar_url,
    },
    assignments: assignmentsResult.assignments,
    totalCount: assignmentsResult.totalCount,
    classes: classes ?? [],
    activities: activities ?? [],
  }
}

export async function getAssignmentEditData(assignmentId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') return null

  const [assignment, { data: classes }, { data: activities }] = await Promise.all([
    getAssignmentById(supabase, assignmentId, user.id),
    supabase
      .from('classes')
      .select('id, name')
      .eq('teacher_id', user.id)
      .order('name'),
    supabase
      .from('activities')
      .select('id, title, category, thumbnail_url')
      .eq('status', 'published')
      .eq('is_published', true)
      .order('title'),
  ])

  if (!assignment?.activity_id) return 'not-found' as const

  return {
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      role: profile.role,
      avatar_url: profile.avatar_url,
    },
    assignment,
    classes: classes ?? [],
    activities: activities ?? [],
  }
}
