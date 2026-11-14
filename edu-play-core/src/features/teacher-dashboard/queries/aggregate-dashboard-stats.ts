import type { StudentRow, ProfileRow, ProgressRow, GameRow } from './types'
import { CATEGORY_LABELS, CATEGORY_COLORS } from './types'
import { formatDateShort, formatWeekday } from '@/lib/i18n/formatters'

// --- Helpers ---

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

// --- Student summaries ---

export interface StudentSummary {
  id: string
  name: string
  avatarUrl: string | null
  className: string | null
  completedGames: number
  inProgressGames: number
  totalGames: number
  averageScore: number
  lastActivityAt: string | null
  focusArea: string
}

export function buildStudentSummaries(
  studentRows: StudentRow[],
  profileMap: Map<string, ProfileRow>,
  progressRows: ProgressRow[],
  gameMap: Map<string, GameRow>,
  classNameMap: Map<string, string>,
): StudentSummary[] {
  const progressByStudent = new Map<string, ProgressRow[]>()
  for (const item of progressRows) {
    const entries = progressByStudent.get(item.student_id) || []
    entries.push(item)
    progressByStudent.set(item.student_id, entries)
  }

  return studentRows
    .map((student) => {
      const studentProfile = profileMap.get(student.id)
      const entries = progressByStudent.get(student.id) || []
      const completedGames = entries.filter((e) => e.status === 'completed').length
      const inProgressGames = entries.filter((e) => e.status === 'in_progress').length
      const averageScore =
        entries.length > 0
          ? Math.round(entries.reduce((sum, e) => sum + (e.score || 0), 0) / entries.length)
          : 0

      const categoryScores = new Map<string, { total: number; count: number }>()
      for (const entry of entries) {
        const game = gameMap.get(entry.game_id)
        const category = game?.category
        if (!category) continue
        const bucket = categoryScores.get(category) || { total: 0, count: 0 }
        bucket.total += entry.score ?? 0
        bucket.count += 1
        categoryScores.set(category, bucket)
      }

      const weakestCategory = [...categoryScores.entries()]
        .map(([category, bucket]) => ({
          category,
          average: bucket.count > 0 ? bucket.total / bucket.count : 0,
        }))
        .sort((a, b) => a.average - b.average)[0]

      return {
        id: student.id,
        name: studentProfile?.full_name || student.username,
        avatarUrl: studentProfile?.avatar_url || null,
        className: classNameMap.get(student.class_id ?? '') || null,
        completedGames,
        inProgressGames,
        totalGames: entries.length,
        averageScore,
        lastActivityAt: entries[0]?.last_played_at || null,
        focusArea: weakestCategory
          ? CATEGORY_LABELS[weakestCategory.category] || weakestCategory.category
          : 'Explorare generală',
      }
    })
    .sort((a, b) => b.averageScore - a.averageScore || b.lastActivityAt?.localeCompare(a.lastActivityAt || '') || 0)
}

// --- Recent activity ---

export interface RecentActivityItem {
  id: string
  studentName: string
  studentAvatarUrl: string | null
  gameTitle: string
  timestamp: string | null
  score: number | null
  status: string
}

export function buildRecentActivity(
  progressRows: ProgressRow[],
  studentRows: StudentRow[],
  profileMap: Map<string, ProfileRow>,
  gameMap: Map<string, GameRow>,
): RecentActivityItem[] {
  return progressRows.slice(0, 6).map((entry) => {
    const student = studentRows.find((s) => s.id === entry.student_id)
    const studentProfile = student ? profileMap.get(student.id) : null
    const game = gameMap.get(entry.game_id)
    return {
      id: entry.id,
      studentName: studentProfile?.full_name || student?.username || 'Elev necunoscut',
      studentAvatarUrl: studentProfile?.avatar_url || null,
      gameTitle: game?.title || 'Joc necunoscut',
      timestamp: entry.last_played_at,
      score: entry.score,
      status: entry.status,
    }
  })
}

// --- Weekly activity ---

export interface WeeklyActivityItem {
  label: string
  dateLabel: string
  count: number
}

export function buildWeeklyActivity(progressRows: ProgressRow[]): WeeklyActivityItem[] {
  const today = new Date()
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    return date
  })

  const weeklyBuckets = new Map<string, number>()
  for (const day of weekDays) {
    weeklyBuckets.set(dayKey(day), 0)
  }

  for (const item of progressRows) {
    if (item.last_played_at) {
      const date = new Date(item.last_played_at)
      const key = dayKey(date)
      if (weeklyBuckets.has(key)) {
        weeklyBuckets.set(key, (weeklyBuckets.get(key) || 0) + 1)
      }
    }
  }

  return weekDays.map((date) => ({
    label: formatWeekday(date),
    dateLabel: formatDateShort(date),
    count: weeklyBuckets.get(dayKey(date)) || 0,
  }))
}

// --- Subject snapshot ---

export interface SubjectSnapshotItem {
  label: string
  value: number
  note: string
  color: string
}

export function buildSubjectSnapshot(
  progressRows: ProgressRow[],
  gameMap: Map<string, GameRow>,
): SubjectSnapshotItem[] {
  const categoryBuckets = new Map<string, { total: number; count: number }>()

  for (const item of progressRows) {
    const game = gameMap.get(item.game_id)
    if (game?.category) {
      const bucket = categoryBuckets.get(game.category) || { total: 0, count: 0 }
      bucket.total += item.score ?? 0
      bucket.count += 1
      categoryBuckets.set(game.category, bucket)
    }
  }

  return [...categoryBuckets.entries()]
    .map(([category, bucket], index) => {
      const average = bucket.count > 0 ? Math.round(bucket.total / bucket.count) : 0
      const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length]
      return {
        label: CATEGORY_LABELS[category] || category,
        value: average,
        note:
          average >= 80
            ? 'Elevii păstrează un ritm bun.'
            : average >= 60
              ? 'Merită câteva lecții ghidate suplimentare.'
              : 'Necesită recapitulare și exercițiu constant.',
        color,
      }
    })
    .sort((a, b) => a.value - b.value)
}
