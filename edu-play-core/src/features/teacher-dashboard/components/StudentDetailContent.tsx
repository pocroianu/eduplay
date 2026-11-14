'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import {
  Button,
  EmptyState,
  InsightPanel,
  StatCard,
} from '@/shared/components/ui/kit'
import { InviteCodeGenerator } from '@/features/parent-portal'
import { ROUTES } from '@/shared/lib/constants'
import { formatRecentActivityDateTime } from '@/lib/i18n/formatters'

interface GameProgress {
  id: string
  status: string
  score: number | null
  time_spent: number | null
  attempts: number
  last_played_at: string | null
  games: { title: string; category: string; difficulty_level: number } | null
}

interface StudentDetailContentProps {
  profile: {
    id: string
    full_name: string
    email: string
    role: string
    avatar_url?: string | null
  }
  student: {
    id: string
    username: string
    fullName: string | null
    avatarUrl: string | null
    className: string | null
  }
  stats: {
    completedGames: number
    totalGames: number
    averageScore: number
    totalTime: number
  }
  progress: GameProgress[]
}

type SubjectMetric = {
  key: string
  label: string
  average: number
  timeMinutes: number
  count: number
  barClass: string
  chartClass: string
  scoreClass: string
}

type SkillCard = {
  label: string
  subtitle: string
  icon: IconName
  accentClass: string
  chipClass: string
  muted?: boolean
}

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary focus:outline-none'

const staggerGrid: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.08 } },
}

const staggerTile: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
}

const categoryLabels: Record<string, string> = {
  literacy: 'Limba română',
  math: 'Matematică',
  phonics: 'Fonetică',
  shapes: 'Științe',
  colors: 'Arte',
  vocabulary: 'Vocabular',
}

const subjectBlueprints: Array<{
  key: string
  label: string
  categories: string[]
  barClass: string
  chartClass: string
  scoreClass: string
}> = [
  {
    key: 'math',
    label: 'Matematică',
    categories: ['math'],
    barClass: 'bg-primary',
    chartClass: 'bg-primary',
    scoreClass: 'text-primary',
  },
  {
    key: 'language',
    label: 'Limba română',
    categories: ['literacy', 'phonics', 'vocabulary'],
    barClass: 'bg-gold',
    chartClass: 'bg-gold',
    scoreClass: 'text-gold',
  },
  {
    key: 'science',
    label: 'Științe',
    categories: ['shapes'],
    barClass: 'bg-primary',
    chartClass: 'bg-primary',
    scoreClass: 'text-primary',
  },
  {
    key: 'arts',
    label: 'Arte',
    categories: ['colors'],
    barClass: 'bg-primary-dim',
    chartClass: 'bg-primary-dim',
    scoreClass: 'text-primary-dim',
  },
]

function InitialsAvatar({
  name,
  src,
  className = '',
  size = 40,
}: {
  name: string
  src?: string | null
  className?: string
  size?: number
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
      />
    )
  }
  return (
    <div
      className={`rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold ${className}`}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

function formatDateLabel(timestamp: string | null) {
  if (!timestamp) return 'Fără activitate recentă'
  return formatRecentActivityDateTime(timestamp)
}

function formatHours(minutes: number) {
  if (minutes <= 0) return '0.0h'
  return `${(minutes / 60).toFixed(1)}h`
}

function formatTotalTime(minutes: number) {
  if (minutes <= 0) return '0m'
  if (minutes < 60) return `${minutes}m`
  const hours = minutes / 60
  return `${hours.toFixed(1)}h`
}

function getPerformanceLabel(score: number) {
  if (score >= 90) return 'Excelent'
  if (score >= 75) return 'Foarte bine'
  if (score >= 60) return 'În progres'
  return 'Are nevoie de sprijin'
}

function getLevelLabel(score: number) {
  if (score >= 90) return 'Nivel Expert'
  if (score >= 75) return 'Nivel Avansat'
  if (score >= 60) return 'Nivel Intermediar'
  if (score > 0) return 'În curs...'
  return 'În curs...'
}

function calculateStreak(progress: GameProgress[]) {
  if (progress.length === 0) return 0

  const days = new Set<string>()
  for (const item of progress) {
    if (!item.last_played_at) continue
    const date = new Date(item.last_played_at)
    days.add(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    )
  }

  if (days.size === 0) return 0

  const sortedDays = [...days].sort().reverse()
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  if (sortedDays[0] !== todayKey && sortedDays[0] !== yesterdayKey) {
    return 0
  }

  let streak = 0
  let cursor = new Date(`${sortedDays[0]}T00:00:00`)
  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    if (!days.has(key)) break
    streak += 1
    cursor = new Date(cursor.getTime() - 86_400_000)
  }

  return streak
}

function buildSubjectMetrics(progress: GameProgress[]): SubjectMetric[] {
  const categoryMap = progress.reduce<Record<string, { scoreTotal: number; count: number; timeMinutes: number }>>(
    (acc, item) => {
      const category = item.games?.category || 'general'
      const existing = acc[category] || { scoreTotal: 0, count: 0, timeMinutes: 0 }
      existing.scoreTotal += item.score ?? 0
      existing.count += 1
      existing.timeMinutes += item.time_spent ?? 0
      acc[category] = existing
      return acc
    },
    {},
  )

  const knownCategories = new Set(subjectBlueprints.flatMap((subject) => subject.categories))
  const fallbackEntries = Object.entries(categoryMap)
    .filter(([key]) => !knownCategories.has(key))
    .sort(([, left], [, right]) => right.count - left.count)

  let fallbackIndex = 0

  return subjectBlueprints.map((subject) => {
    const matches = subject.categories
      .map((category) => categoryMap[category])
      .filter((entry): entry is { scoreTotal: number; count: number; timeMinutes: number } => Boolean(entry))

    let count = matches.reduce((sum, entry) => sum + entry.count, 0)
    let scoreTotal = matches.reduce((sum, entry) => sum + entry.scoreTotal, 0)
    let timeMinutes = matches.reduce((sum, entry) => sum + entry.timeMinutes, 0)

    if (count === 0 && fallbackIndex < fallbackEntries.length) {
      const [fallbackKey, fallbackValue] = fallbackEntries[fallbackIndex]
      fallbackIndex += 1
      count = fallbackValue.count
      scoreTotal = fallbackValue.scoreTotal
      timeMinutes = fallbackValue.timeMinutes

      return {
        key: fallbackKey,
        label: categoryLabels[fallbackKey] || subject.label,
        average: count > 0 ? Math.round(scoreTotal / count) : 0,
        timeMinutes,
        count,
        barClass: subject.barClass,
        chartClass: subject.chartClass,
        scoreClass: subject.scoreClass,
      }
    }

    return {
      key: subject.key,
      label: subject.label,
      average: count > 0 ? Math.round(scoreTotal / count) : 0,
      timeMinutes,
      count,
      barClass: subject.barClass,
      chartClass: subject.chartClass,
      scoreClass: subject.scoreClass,
    }
  })
}

function buildSkillCards(
  subjectMetrics: SubjectMetric[],
  averageScore: number,
  completionRate: number,
  streak: number,
): SkillCard[] {
  const math = subjectMetrics[0]?.average || averageScore
  const language = subjectMetrics[1]?.average || averageScore
  const science = subjectMetrics[2]?.average || averageScore
  const arts = subjectMetrics[3]?.average || averageScore
  const focusScore = streak > 0 ? Math.min(100, 52 + streak * 8) : Math.max(0, averageScore - 18)
  const communicationScore = language > 0 ? Math.max(0, language - 10) : 0
  const problemScore = Math.round((science + averageScore + completionRate) / 3)

  return [
    {
      label: 'Logică',
      subtitle: getLevelLabel(math),
      icon: 'Flag',
      accentClass: 'text-primary',
      chipClass: 'bg-primary/10',
      muted: math === 0,
    },
    {
      label: 'Vocabular',
      subtitle: getLevelLabel(language),
      icon: 'BookOpen',
      accentClass: 'text-gold',
      chipClass: 'bg-gold/10',
      muted: language === 0,
    },
    {
      label: 'Problem Solving',
      subtitle: getLevelLabel(problemScore),
      icon: 'Trophy',
      accentClass: 'text-primary',
      chipClass: 'bg-primary/10',
      muted: problemScore === 0,
    },
    {
      label: 'Creativitate',
      subtitle: getLevelLabel(arts),
      icon: 'Sparkle',
      accentClass: 'text-primary-dim',
      chipClass: 'bg-primary-dim/10',
      muted: arts === 0,
    },
    {
      label: 'Comunicare',
      subtitle: getLevelLabel(communicationScore),
      icon: 'PaperPlaneTilt',
      accentClass: 'text-on-surface-variant',
      chipClass: 'bg-surface-container',
      muted: communicationScore < 60,
    },
    {
      label: 'Concentrare',
      subtitle: getLevelLabel(focusScore),
      icon: 'Clock',
      accentClass: 'text-on-surface-variant',
      chipClass: 'bg-surface-container',
      muted: focusScore < 60,
    },
  ]
}

export function StudentDetailContent({ student, stats, progress }: StudentDetailContentProps) {
  const reduceMotion = useReducedMotion()
  const studentName = student.fullName || student.username
  const completionRate = stats.totalGames > 0 ? Math.round((stats.completedGames / stats.totalGames) * 100) : 0
  const streak = calculateStreak(progress)
  const performanceLabel = getPerformanceLabel(stats.averageScore)
  const subjectMetrics = buildSubjectMetrics(progress)
  const skillCards = buildSkillCards(subjectMetrics, stats.averageScore, completionRate, streak)
  const recentActivity = progress.slice(0, 4)
  const weakestSubject = [...subjectMetrics]
    .filter((subject) => subject.count > 0)
    .sort((left, right) => left.average - right.average)[0]
  const needsAttention = weakestSubject ? weakestSubject.average < 70 : stats.averageScore < 70

  const attentionCopy = weakestSubject
    ? `${studentName} are nevoie de consolidare la ${weakestSubject.label.toLowerCase()}. Activitățile scurte și feedbackul imediat ajută cel mai mult în etapa aceasta.`
    : `${studentName} nu are încă suficiente activități pentru un semnal clar, așa că merită urmărite următoarele jocuri completate.`

  const rewardTarget = Math.max(5, Math.ceil(Math.max(stats.completedGames, 1) / 5) * 5)
  const rewardProgress = rewardTarget > 0 ? Math.round((stats.completedGames / rewardTarget) * 100) : 0
  const rewardTitle =
    stats.averageScore >= 90 ? 'Micul Geniu' : stats.averageScore >= 75 ? 'Explorator Curajos' : 'Steaua Progresului'
  const rewardRemaining = Math.max(0, rewardTarget - stats.completedGames)
  const maxTimeMinutes = Math.max(...subjectMetrics.map((subject) => subject.timeMinutes), 1)

  const overviewStats: Array<{
    label: string
    value: string | number
    icon: IconName
    tone: 'primary' | 'tertiary' | 'secondary' | 'warning'
  }> = [
    {
      label: 'Jocuri finalizate',
      value: stats.completedGames,
      icon: 'Trophy',
      tone: 'tertiary',
    },
    {
      label: 'Scor mediu',
      value: `${stats.averageScore}%`,
      icon: 'ChartLineUp',
      tone: stats.averageScore >= 70 ? 'tertiary' : 'warning',
    },
    {
      label: 'Timp total',
      value: formatTotalTime(stats.totalTime),
      icon: 'Clock',
      tone: 'primary',
    },
    {
      label: 'Zile consecutive',
      value: streak,
      icon: 'Fire',
      tone: streak >= 3 ? 'secondary' : 'warning',
    },
  ]

  return (
    <div className="p-6 lg:p-10">
        <div className="mx-auto max-w-[1440px] space-y-12">
          {/* Summary header */}
          <header
            aria-labelledby="student-report-heading"
            className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex items-center gap-4 min-w-0">
              <Link
                href={ROUTES.TEACHER.STUDENTS}
                aria-label="Înapoi la lista de elevi"
                className={`inline-flex items-center gap-2 rounded-full bg-surface-container px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container-high transition-colors ${FOCUS_RING}`}
              >
                <Icon name="ArrowLeft" size={18} aria-hidden />
                <span>Înapoi</span>
              </Link>
              <div className="flex items-center gap-3 min-w-0">
                <InitialsAvatar
                  name={studentName}
                  src={student.avatarUrl}
                  size={48}
                  className="w-12 h-12 text-sm shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Raport elev
                  </p>
                  <h1
                    id="student-report-heading"
                    className="text-2xl md:text-[30px] font-bold text-on-surface font-headline leading-tight truncate"
                  >
                    {studentName}
                  </h1>
                  {student.className ? (
                    <p className="text-sm text-on-surface-variant truncate">
                      {student.className}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 md:shrink-0">
              <span
                className="inline-flex items-center self-start rounded-full bg-primary/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary md:self-auto"
              >
                {performanceLabel}
              </span>
              <Button
                href={ROUTES.TEACHER.STUDENTS}
                variant="secondary"
                size="md"
                className={FOCUS_RING}
              >
                Vezi toți elevii
              </Button>
            </div>
          </header>

          {/* Overview stat cards */}
          <motion.div
            variants={reduceMotion ? undefined : staggerGrid}
            initial={reduceMotion ? false : 'initial'}
            animate={reduceMotion ? undefined : 'animate'}
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6"
          >
            {overviewStats.map((card) => (
              <motion.div
                key={card.label}
                variants={reduceMotion ? undefined : staggerTile}
              >
                <StatCard
                  label={card.label}
                  value={card.value}
                  icon={card.icon}
                  tone={card.tone}
                  variant="standard"
                />
              </motion.div>
            ))}
          </motion.div>

          {/* Performance + sidebar grid */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.72fr)_360px] gap-8">
            {/* Performance card */}
            <section
              aria-labelledby="performance-heading"
              className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-soft-sm lg:p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <div>
                  <h2
                    id="performance-heading"
                    className="text-2xl lg:text-[28px] font-bold text-on-surface font-headline mb-1"
                  >
                    Performanță generală
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Media scorurilor în funcție de disciplină
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
                  {performanceLabel}
                </span>
              </div>

              <ul className="flex flex-col gap-5 list-none p-0 m-0">
                {subjectMetrics.map((subject) => {
                  const value = subject.count > 0 ? subject.average : 0
                  return (
                    <li key={subject.key}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-on-surface">
                          {subject.label}
                        </span>
                        <span className={`text-sm font-bold ${subject.scoreClass}`}>
                          {value}%
                        </span>
                      </div>
                      <div
                        className="h-3 w-full rounded-full bg-surface-container overflow-hidden"
                        role="progressbar"
                        aria-valuenow={value}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${subject.label}: ${value}% scor mediu`}
                      >
                        <div
                          className={`h-full rounded-full ${subject.barClass}`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>

            {/* Right rail */}
            <aside className="flex flex-col gap-6">
              {/* Attention insight */}
              <InsightPanel
                eyebrow={needsAttention ? 'Atenție necesară' : 'Pe drumul cel bun'}
                icon={needsAttention ? 'Warning' : 'Sparkle'}
                title={
                  weakestSubject
                    ? `${weakestSubject.label} sub ritm`
                    : needsAttention
                      ? 'Încă fără semnal clar'
                      : `${studentName} merge constant`
                }
                description={attentionCopy}
                action={
                  <Button
                    href={ROUTES.TEACHER.STUDENTS}
                    variant="primary"
                    size="lg"
                    fullWidth
                    className={FOCUS_RING}
                  >
                    Vezi elevii
                  </Button>
                }
              />

              {/* Recent activity */}
              <section
                aria-labelledby="recent-activity-heading"
                className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-soft-sm"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Icon
                    name="Clock"
                    size={20}
                    className="text-primary"
                    aria-hidden
                  />
                  <h3
                    id="recent-activity-heading"
                    className="text-[18px] font-bold text-on-surface font-headline"
                  >
                    Activitate recentă
                  </h3>
                </div>

                {recentActivity.length === 0 ? (
                  <EmptyState
                    icon="ClockCounterClockwise"
                    title="Nu există activitate recentă"
                    description="După primele jocuri, vei vedea aici scorurile și durata fiecărei sesiuni."
                    className="py-10"
                  />
                ) : (
                  <ul className="flex flex-col gap-4 list-none p-0 m-0">
                    {recentActivity.map((item) => {
                      const scoreIsStrong = (item.score ?? 0) >= 80
                      return (
                        <li key={item.id} className="flex items-start gap-3">
                          <span
                            aria-hidden
                            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                              scoreIsStrong ? 'bg-primary' : 'bg-primary'
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-on-surface truncate">
                              {item.games?.title || 'Activitate EduPlay'}
                            </p>
                            <p className="text-xs text-on-surface-variant mt-0.5">
                              {formatDateLabel(item.last_played_at)}
                              {item.score !== null ? ` • Scor ${item.score}%` : ''}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </aside>
          </div>

          {/* Skills mastery */}
          <section
            aria-labelledby="skills-heading"
            className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-soft-sm lg:p-8"
          >
            <h2
              id="skills-heading"
              className="text-2xl lg:text-[28px] font-bold text-on-surface font-headline mb-8"
            >
              Stăpânirea abilităților
            </h2>

            <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 list-none p-0 m-0">
              {skillCards.map((card) => (
                <li
                  key={card.label}
                  className={`rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-center shadow-soft-sm ${
                    card.muted ? 'opacity-70' : ''
                  }`}
                >
                  <div
                    className={`w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center ${card.chipClass} ${card.accentClass}`}
                    aria-hidden
                  >
                    <Icon name={card.icon} size={24} />
                  </div>
                  <p className="text-xs font-bold text-on-surface">{card.label}</p>
                  <p className="text-[10px] text-on-surface-variant mt-1">{card.subtitle}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Time spent + reward */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Time spent chart */}
            <section
              aria-labelledby="time-spent-heading"
              className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-soft-sm lg:p-8"
            >
              <h2
                id="time-spent-heading"
                className="text-xl font-bold text-on-surface font-headline mb-6"
              >
                Timp petrecut pe discipline
              </h2>

              <div className="flex items-end justify-between h-56 gap-4">
                {subjectMetrics.map((subject) => {
                  const height =
                    subject.timeMinutes > 0
                      ? Math.max(36, Math.round((subject.timeMinutes / maxTimeMinutes) * 160))
                      : 24
                  const shortLabel =
                    subject.label === 'Limba română'
                      ? 'ROM'
                      : subject.label === 'Matematică'
                        ? 'MAT'
                        : subject.label === 'Științe'
                          ? 'ȘT'
                          : 'ART'

                  return (
                    <div
                      key={subject.key}
                      className="flex flex-col items-center justify-end flex-1 h-full"
                    >
                      <span className="text-[11px] font-bold text-on-surface mb-2">
                        {formatHours(subject.timeMinutes)}
                      </span>
                      <div
                        className={`w-full max-w-[60px] rounded-t-lg ${subject.chartClass}`}
                        style={{ height: `${height}px` }}
                        aria-label={`${subject.label}: ${formatHours(subject.timeMinutes)}`}
                      />
                      <span className="mt-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {shortLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Reward card */}
            <section
              aria-labelledby="reward-heading"
              className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-soft-sm lg:p-8 flex flex-col"
            >
              <div className="flex items-start gap-4 mb-6">
                <div
                  className="w-[52px] h-[52px] rounded-2xl bg-gold/10 text-gold flex items-center justify-center shrink-0"
                  aria-hidden
                >
                  <Icon name="Medal" size={28} />
                </div>
                <div>
                  <h2
                    id="reward-heading"
                    className="text-xl font-bold text-on-surface font-headline mb-1"
                  >
                    Următoarea recompensă
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    {rewardRemaining > 0
                      ? `Mai are nevoie de ${rewardRemaining} jocuri finalizate pentru insigna "${rewardTitle}".`
                      : `A atins pragul pentru insigna "${rewardTitle}".`}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center rounded-full bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold">
                    Progres badge
                  </span>
                  <span className="text-xs font-bold text-gold">
                    {rewardProgress}%
                  </span>
                </div>
                <div
                  className="h-3 rounded-full bg-surface-container overflow-hidden"
                  role="progressbar"
                  aria-valuenow={rewardProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progres recompensă: ${rewardProgress}%`}
                >
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{ width: `${rewardProgress}%` }}
                  />
                </div>
              </div>

              <Button
                href={ROUTES.TEACHER.STUDENTS}
                variant="secondary"
                size="lg"
                fullWidth
                className={`mt-auto ${FOCUS_RING}`}
              >
                Vezi elevii
              </Button>
            </section>
          </div>

          {/* Family connection */}
          <section
            aria-labelledby="family-heading"
            className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-soft-sm lg:p-8"
          >
            <div className="flex flex-col xl:flex-row gap-6 xl:items-start xl:justify-between">
              <div className="max-w-[520px]">
                <h2
                  id="family-heading"
                  className="text-xl font-bold text-on-surface font-headline mb-2"
                >
                  Conectare familie
                </h2>
                <p className="text-sm leading-relaxed text-on-surface-variant">
                  Codul de conectare rămâne disponibil mai jos — îl găsești după raportul principal ca să păstrăm ierarhia vizuală a ecranului.
                </p>
              </div>

              <div className="flex-1 max-w-full xl:max-w-[420px]">
                <InviteCodeGenerator studentId={student.id} studentName={studentName} />
              </div>
            </div>
          </section>
        </div>
    </div>
  )
}
