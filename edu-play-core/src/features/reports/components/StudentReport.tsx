'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Progress, Table } from '@mantine/core'
import { Button, MantineBoundary } from '@/shared/components/ui/kit'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { StatCard } from '@/shared/components/ui/StatCard'
import { ProgressBar } from '@/shared/components/ui/ProgressBar'
import { fadeInUp, staggerContainer, staggerItem } from '@/config/animations'
import { ROUTES } from '@/shared/lib/constants/routes'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudentInfo {
  id: string
  name: string
  avatarUrl?: string | null
  className: string
  grade: string
}

export interface OverallStats {
  gamesPlayed: number
  avgScore: number
  timeSpentMinutes: number
  streakDays: number
}

export interface SubjectProgress {
  subject: string
  /** Short label for charts (e.g. "Mat", "Rom") */
  shortLabel: string
  score: number
  color: string
  hoursSpent: number
}

export interface RecentActivityItem {
  id: string
  title: string
  description: string
  timestamp: string
  type: 'test' | 'lesson' | 'game' | 'achievement'
}

export interface GameHistoryItem {
  id: string
  gameName: string
  subject: string
  score: number
  maxScore: number
  completedAt: string
  duration: string
}

export interface SkillBadge {
  icon: IconName
  label: string
  level: string
  color: string
  unlocked: boolean
}

export interface ImprovementArea {
  title: string
  description: string
}

export interface StudentReportProps {
  student: StudentInfo
  stats: OverallStats
  subjectProgress: SubjectProgress[]
  recentActivity: RecentActivityItem[]
  gameHistory: GameHistoryItem[]
  skills?: SkillBadge[]
  strengths?: string[]
  improvements?: ImprovementArea[]
  nextReward?: {
    label: string
    description: string
    progress: number
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function activityDotColor(type: RecentActivityItem['type']): string {
  switch (type) {
    case 'test':
      return 'bg-primary'
    case 'lesson':
      return 'bg-primary'
    case 'game':
      return 'bg-gold'
    case 'achievement':
      return 'bg-primary-dim'
    default:
      return 'bg-outline'
  }
}

function performanceLabel(avg: number): { text: string; className: string } {
  if (avg >= 90) return { text: 'Excelent', className: 'bg-primary-soft text-primary-deep' }
  if (avg >= 75) return { text: 'Foarte bine', className: 'bg-gold-soft text-gold-deep' }
  if (avg >= 60) return { text: 'Bine', className: 'bg-primary-container text-on-primary-container' }
  return { text: 'Necesită atenție', className: 'bg-error-container text-white' }
}

const REPORT_TONES = [
  {
    textClass: 'text-primary',
    fill: 'var(--mantine-color-violet-6, var(--color-primary))',
    softClass: 'bg-primary/10 text-primary',
  },
  {
    textClass: 'text-gold-deep',
    fill: 'var(--mantine-color-yellow-6, var(--color-gold))',
    softClass: 'bg-gold/10 text-gold-deep',
  },
  {
    textClass: 'text-primary-dim',
    fill: 'var(--mantine-color-violet-4, var(--color-primary-dim))',
    softClass: 'bg-primary-dim/10 text-primary-dim',
  },
] as const

function reportTone(index: number) {
  return REPORT_TONES[index % REPORT_TONES.length]
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Student header card with avatar, name, class */
function StudentHeader({ student }: { student: StudentInfo }) {
  return (
    <div className="flex items-center gap-4">
      {student.avatarUrl ? (
        <Image
          src={student.avatarUrl}
          alt={student.name}
          width={56}
          height={56}
          className="rounded-full object-cover"
        />
      ) : (
        <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xl font-headline">
          {student.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </div>
      )}
      <div>
        <h1 className="font-headline font-bold text-xl text-on-background">
          Raport {student.name}
        </h1>
        <p className="text-sm text-on-surface-variant">
          {student.className} &middot; {student.grade}
        </p>
      </div>
    </div>
  )
}

/** Overall stats row */
function StatsRow({ stats }: { stats: OverallStats }) {
  return (
    <motion.div
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <StatCard
          label="Jocuri Jucate"
          value={stats.gamesPlayed}
          icon="GameController"
          variant="primary"
        />
      </motion.div>
      <motion.div variants={staggerItem}>
        <StatCard
          label="Scor Mediu"
          value={`${stats.avgScore}%`}
          icon="TrendUp"
          variant="tertiary"
        />
      </motion.div>
      <motion.div variants={staggerItem}>
        <StatCard
          label="Timp Petrecut"
          value={formatMinutes(stats.timeSpentMinutes)}
          icon="Clock"
          variant="secondary"
        />
      </motion.div>
      <motion.div variants={staggerItem}>
        <StatCard
          label="Serie Zile"
          value={stats.streakDays}
          icon="Fire"
          variant="error"
        />
      </motion.div>
    </motion.div>
  )
}

/** Subject progress bars matching the Stitch design */
function SubjectProgressSection({
  subjects,
  avgScore,
}: {
  subjects: SubjectProgress[]
  avgScore: number
}) {
  const badge = performanceLabel(avgScore)

  return (
    <motion.div
      className="bg-surface-container-lowest border border-outline-variant shadow-soft-sm rounded-xl p-6 lg:p-8"
      variants={fadeInUp}
      initial="initial"
      animate="animate"
    >
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-3">
        <div>
          <h2 className="font-headline text-xl lg:text-2xl font-bold text-on-surface">
            Performanță generală
          </h2>
          <p className="text-on-surface-variant text-sm">
            Media scorurilor în funcție de disciplină
          </p>
        </div>
        <span
          className={`self-start px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${badge.className}`}
        >
          {badge.text}
        </span>
      </div>

      <div className="space-y-5">
        {subjects.map((s, index) => {
          const tone = reportTone(index)
          return (
          <div key={s.subject} className="space-y-2">
            <div className="flex justify-between text-sm font-bold">
              <span>{s.subject}</span>
              <span className={tone.textClass}>{s.score}%</span>
            </div>
            <MantineBoundary>
              <Progress value={Math.max(0, Math.min(100, s.score))}
                color={tone.fill} size={16} aria-label={`${s.subject}: ${s.score}%`} />
            </MantineBoundary>
          </div>
          )
        })}
      </div>
    </motion.div>
  )
}

/** Attention / improvement sidebar card */
function ImprovementCard({ improvements }: { improvements: ImprovementArea[] }) {
  if (improvements.length === 0) return null

  return (
    <div className="rounded-xl bg-error/10 p-6">
      <div className="flex items-center gap-3 text-error mb-3">
        <Icon name="Warning" />
        <h3 className="font-bold">Atenție necesară</h3>
      </div>
      <div className="space-y-3">
        {improvements.map((item, i) => (
          <div key={i}>
            <p className="text-sm font-bold text-on-background">{item.title}</p>
            <p className="text-sm text-on-surface-variant">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Recent activity timeline */
function ActivityTimeline({ items }: { items: RecentActivityItem[] }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant shadow-soft-sm rounded-xl p-6">
      <h3 className="font-bold mb-4 flex items-center gap-2">
        <Icon name="Clock" className="text-primary" />
        Activitate recentă
      </h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3">
            <div className={`w-2 h-2 rounded-full ${activityDotColor(item.type)} mt-1.5 shrink-0`} />
            <div className="text-xs min-w-0">
              <p className="font-bold truncate">{item.title}</p>
              <p className="text-on-surface-variant">{item.description}</p>
              <p className="text-on-surface-variant opacity-60 mt-0.5">{item.timestamp}</p>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-on-surface-variant text-center py-4">
            Nicio activitate recentă.
          </p>
        )}
      </div>
    </div>
  )
}

/** Skills mastery badge grid */
function SkillsMastery({ skills }: { skills: SkillBadge[] }) {
  if (skills.length === 0) return null

  return (
    <motion.section
      className="bg-surface-container rounded-xl p-6 lg:p-8"
      variants={fadeInUp}
      initial="initial"
      animate="animate"
    >
      <h2 className="font-headline text-xl lg:text-2xl font-bold text-on-surface mb-6">
        Stăpânirea abilităților
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {skills.map((skill, index) => {
          const tone = reportTone(index)
          return (
          <div
            key={skill.label}
            className={`bg-surface-container-lowest border border-outline-variant shadow-soft-sm flex flex-col items-center rounded-lg p-4 text-center transition-all ${
              skill.unlocked ? '' : 'grayscale opacity-60'
            }`}
          >
            <div
              className={`w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center mb-3 ${
                skill.unlocked ? tone.softClass : 'bg-surface-container text-outline'
              }`}
            >
              <Icon
                name={skill.icon}
                weight={skill.unlocked ? 'fill' : 'regular'}
                className={skill.unlocked ? '' : 'text-outline'}
                size={30}
              />
            </div>
            <span className="text-xs font-bold">{skill.label}</span>
            <span className="text-xs text-on-surface-variant">{skill.level}</span>
          </div>
          )
        })}
      </div>
    </motion.section>
  )
}

/** Time spent per subject bar chart */
function TimeBySubjectChart({ subjects }: { subjects: SubjectProgress[] }) {
  const data = subjects.map((s, index) => ({
    name: s.shortLabel,
    hours: s.hoursSpent,
    fill: reportTone(index).fill,
  }))

  return (
    <div className="bg-surface-container-lowest border border-outline-variant shadow-soft-sm rounded-xl p-6 lg:p-8">
      <div>
        <h3 className="font-bold text-lg mb-6">Timp petrecut pe discipline</h3>
        <div className="w-full h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--mantine-color-gray-2, var(--color-outline-variant))"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}h`}
              />
              <Tooltip
                formatter={(value) => [`${value}h`, 'Timp']}
                contentStyle={{
                  borderRadius: 'var(--mantine-radius-md, 8px)',
                  border: '1px solid var(--mantine-color-gray-2, var(--color-outline-variant))',
                  boxShadow: 'var(--mantine-shadow-md, var(--shadow-soft-sm))',
                }}
              />
              <Bar dataKey="hours" radius={[8, 8, 0, 0]} maxBarSize={48}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

/** Next reward card */
function NextRewardCard({
  reward,
}: {
  reward: { label: string; description: string; progress: number }
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant shadow-soft-sm rounded-xl p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-gold-container/20 rounded-xl">
          <Icon name="Trophy" className="text-gold text-2xl" />
        </div>
        <div>
          <h3 className="font-bold text-lg">Următoarea recompensă</h3>
          <p className="text-sm text-on-surface-variant">{reward.description}</p>
        </div>
      </div>
      <ProgressBar
        value={reward.progress}
        max={100}
        color="bg-gold"
        height="h-3"
        label={reward.label}
        showPercent
      />
    </div>
  )
}

/** Game history table */
function GameHistoryTable({ games }: { games: GameHistoryItem[] }) {
  if (games.length === 0) return null

  return (
    <motion.div
      className="bg-surface-container-lowest border border-outline-variant shadow-soft-sm overflow-hidden rounded-xl"
      variants={fadeInUp}
      initial="initial"
      animate="animate"
    >
      <div className="p-6 lg:p-8 pb-0">
        <h2 className="font-headline text-xl lg:text-2xl font-bold text-on-surface mb-2">
          Istoric jocuri
        </h2>
        <p className="text-on-surface-variant text-sm mb-4">
          Ultimele jocuri finalizate
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <Table className="w-full text-sm">
          <Table.Thead>
            <Table.Tr className="bg-surface-container">
              <Table.Th className="text-left px-6 lg:px-8 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wider">
                Joc
              </Table.Th>
              <Table.Th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wider">
                Disciplina
              </Table.Th>
              <Table.Th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wider">
                Scor
              </Table.Th>
              <Table.Th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wider">
                Durata
              </Table.Th>
              <Table.Th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wider">
                Data
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {games.map((game) => {
              const scorePercent = game.maxScore > 0 ? Math.round((game.score / game.maxScore) * 100) : 0
              return (
                <Table.Tr
                  key={game.id}
                  className="transition-colors hover:bg-surface-container/40 even:bg-surface-container/25"
                >
                  <Table.Td className="px-6 lg:px-8 py-4 font-bold text-on-background">
                    {game.gameName}
                  </Table.Td>
                  <Table.Td className="px-4 py-4 text-on-surface-variant">{game.subject}</Table.Td>
                  <Table.Td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-on-background">
                        {game.score}/{game.maxScore}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          scorePercent >= 80
                            ? 'bg-primary-soft text-primary-deep'
                            : scorePercent >= 60
                              ? 'bg-gold-soft text-gold-deep'
                              : 'bg-error-container/20 text-error'
                        }`}
                      >
                        {scorePercent}%
                      </span>
                    </div>
                  </Table.Td>
                  <Table.Td className="px-4 py-4 text-on-surface-variant">{game.duration}</Table.Td>
                  <Table.Td className="px-4 py-4 text-on-surface-variant">{game.completedAt}</Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3 p-4">
        {games.map((game) => {
          const scorePercent = game.maxScore > 0 ? Math.round((game.score / game.maxScore) * 100) : 0
          return (
            <div
              key={game.id}
              className="bg-surface-container p-4 rounded-xl space-y-2"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-on-background">{game.gameName}</p>
                  <p className="text-xs text-on-surface-variant">{game.subject}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    scorePercent >= 80
                      ? 'bg-primary-soft text-primary-deep'
                      : scorePercent >= 60
                        ? 'bg-gold-soft text-gold-deep'
                        : 'bg-error-container/20 text-error'
                  }`}
                >
                  {scorePercent}%
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <Icon name="Clock" size={14} />
                  {game.duration}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="Calendar" size={14} />
                  {game.completedAt}
                </span>
              </div>
              <ProgressBar
                value={scorePercent}
                max={100}
                color={
                  scorePercent >= 80
                    ? 'bg-primary'
                    : scorePercent >= 60
                      ? 'bg-gold'
                      : 'bg-error'
                }
                height="h-2"
              />
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

/** Strengths list */
function StrengthsList({ strengths }: { strengths: string[] }) {
  if (strengths.length === 0) return null

  return (
    <div className="rounded-xl bg-primary-container/10 p-6">
      <div className="flex items-center gap-3 text-primary mb-3">
        <Icon name="ThumbsUp" weight="fill" />
        <h3 className="font-bold">Puncte forte</h3>
      </div>
      <ul className="space-y-2">
        {strengths.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-on-background">
            <Icon name="CheckCircle" className="text-primary shrink-0 mt-0.5" size={16} />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * StudentReport - Detailed student progress report (Raport Detaliat Elev).
 *
 * Teacher/admin facing component that displays comprehensive student
 * performance data including subject scores, skills, game history, and
 * areas for improvement. Matches the Stitch Duo design system.
 */
export function StudentReport({
  student,
  stats,
  subjectProgress,
  recentActivity,
  gameHistory,
  skills = [],
  strengths = [],
  improvements = [],
  nextReward,
}: StudentReportProps) {
  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrint = () => {
    setIsPrinting(true)
    // Allow a tick for state to settle, then trigger browser print
    requestAnimationFrame(() => {
      window.print()
      setIsPrinting(false)
    })
  }

  return (
    <MantineBoundary>
    <div className="space-y-8">
      {/* Header row with student info + actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <StudentHeader student={student} />
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            variant="secondary"
            className="motion-safe:active:translate-y-px"
          >
            <Icon name="Printer" size={18} />
            <span className="hidden sm:inline">Exportă / Printează</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Button
            href={ROUTES.TEACHER.STUDENT(student.id)}
            variant="primary"
            className="motion-safe:active:translate-y-px"
          >
            <Icon name="User" size={18} />
            <span className="hidden sm:inline">Profil elev</span>
          </Button>
        </div>
      </div>

      {/* Overall stats */}
      <StatsRow stats={stats} />

      {/* Bento grid: performance + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Performance bars - 8 cols */}
        <div className="lg:col-span-8">
          <SubjectProgressSection subjects={subjectProgress} avgScore={stats.avgScore} />
        </div>

        {/* Sidebar cards - 4 cols */}
        <div className="lg:col-span-4 space-y-6">
          {improvements.length > 0 && <ImprovementCard improvements={improvements} />}

          <ActivityTimeline items={recentActivity.slice(0, 5)} />

          {strengths.length > 0 && <StrengthsList strengths={strengths} />}
        </div>
      </div>

      {/* Skills mastery */}
      {skills.length > 0 && <SkillsMastery skills={skills} />}

      {/* Detailed metrics row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeBySubjectChart subjects={subjectProgress} />
        {nextReward && <NextRewardCard reward={nextReward} />}
      </div>

      {/* Game history */}
      <GameHistoryTable games={gameHistory} />
    </div>
    </MantineBoundary>
  )
}
