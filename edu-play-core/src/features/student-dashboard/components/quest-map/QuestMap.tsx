'use client'

import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChunkyButton,
  DuoAvatar,
  type VulpitaMood,
} from '@/shared/components/ui/kit'
import { formatNumber } from '@/lib/i18n/formatters'
import { ROUTES } from '@/shared/lib/constants/routes'
import { QuestNode } from './QuestNode'
import { QuestPath } from './QuestPath'
import { StatBubble } from './StatBubble'
import { TodaysLessons } from './TodaysLessons'
import { VulpitaPanel } from './VulpitaPanel'
import type { QuestLesson, QuestNodeState, QuestUnit } from './types'
import { StudentActivitiesLane, type StudentActivityCard } from '../StudentActivitiesLane'

export interface QuestMapProps {
  profile: {
    fullName: string
    firstName: string
    avatarUrl?: string | null
    className?: string | null
    primarySubject?: string | null
  }
  stats: {
    lives: number
    weeklyXp: number
    streak: number
  }
  units: QuestUnit[]
  lessons: QuestLesson[]
  activities?: StudentActivityCard[]
}

function pickMood(units: QuestUnit[], remainingLessons: number): VulpitaMood {
  if (units.length === 0) return 'think'
  if (units.every((unit) => unit.state === 'done')) return 'happy'
  if (remainingLessons === 0) return 'think'
  return 'cheer'
}

const UNIT_LABEL_STYLE: Record<QuestNodeState, CSSProperties> = {
  active: {
    backgroundColor: 'var(--color-gold-soft)',
    border: '2px solid var(--color-gold)',
    boxShadow: 'var(--shadow-soft)',
    color: 'var(--color-on-surface)',
  },
  done: {
    backgroundColor: 'var(--color-surface-container-lowest)',
    border: '1px solid var(--color-outline-variant)',
    boxShadow: 'var(--shadow-soft-sm)',
    color: 'var(--color-on-surface)',
  },
  upcoming: {
    backgroundColor: 'var(--color-surface-container-lowest)',
    border: '1px solid var(--color-outline-variant)',
    boxShadow: 'var(--shadow-soft-sm)',
    color: 'var(--color-on-surface)',
  },
  locked: {
    backgroundColor: 'var(--color-surface-container-lowest)',
    border: '1px solid var(--color-outline-variant)',
    boxShadow: 'var(--shadow-soft-sm)',
    color: 'var(--color-on-surface-muted)',
  },
}

const GUIDANCE_PILL_STYLE: Record<QuestNodeState, CSSProperties> = {
  active: {
    backgroundColor: 'var(--color-gold)',
    color: 'var(--color-on-gold)',
  },
  done: {
    backgroundColor: 'var(--color-primary-soft)',
    color: 'var(--color-primary-deep)',
  },
  upcoming: {
    backgroundColor: 'var(--color-blue-soft)',
    color: 'var(--color-blue-deep)',
  },
  locked: {
    backgroundColor: 'var(--color-surface-container)',
    color: 'var(--color-on-surface-muted)',
  },
}

function QuestUnitRow({ unit, index }: { unit: QuestUnit; index: number }) {
  const { t } = useTranslation('student')
  const isEven = index % 2 === 0
  const stateLabel = t(`questMap.node.stateLabel.${unit.state}`)
  const stateGuidance = t(`questMap.node.guidance.${unit.state}`)
  const ariaLabel = t('questMap.node.ariaLabel', {
    label: unit.label,
    state: stateLabel,
  })

  return (
    <li className={`flex ${isEven ? 'justify-start pl-6' : 'justify-end pr-6'}`}>
      <div className={`flex items-center gap-3.5 ${isEven ? '' : 'flex-row-reverse'}`}>
        <QuestNode
          state={unit.state}
          color={unit.nodeColor}
          href={unit.href}
          ariaLabel={ariaLabel}
        />
        <div
          className="max-w-[220px] rounded-md px-4 py-2.5 text-[18px] font-bold tracking-tight"
          style={UNIT_LABEL_STYLE[unit.state]}
        >
          <span className="block">{unit.label}</span>
          <span
            className="mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[18px] font-bold leading-tight"
            style={GUIDANCE_PILL_STYLE[unit.state]}
          >
            {stateGuidance}
          </span>
        </div>
      </div>
    </li>
  )
}

export function QuestMap({ profile, stats, units, lessons, activities = [] }: QuestMapProps) {
  const { t } = useTranslation('student')

  const remainingLessons = lessons.filter((lesson) => !lesson.done).length
  const mood = pickMood(units, remainingLessons)
  const subtitle = profile.className
    ? t('questMap.subtitle', {
        className: profile.className,
        subject: profile.primarySubject ?? t('questMap.subjectFallback'),
      })
    : t('questMap.subtitleNoClass')

  return (
    <div
      data-mode="kid"
      className="grid min-h-screen w-full grid-cols-1 bg-primary-wash font-body text-on-surface lg:grid-cols-[1.5fr_360px]"
    >
      <section
        aria-labelledby="quest-map-heading"
        className="relative overflow-y-auto px-5 py-5 md:px-8 md:py-6"
      >
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <DuoAvatar name={profile.fullName} size={56} ring="var(--color-gold)" />
            <div>
              <h1 id="quest-map-heading" className="text-[22px] font-bold tracking-tight">
                {t('questMap.greeting', { name: profile.firstName })}
              </h1>
              <p className="text-[18px] font-semibold text-on-surface-variant">
                {subtitle}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatBubble
              tone="coral"
              glyph="heart"
              big={stats.lives}
              small={t('questMap.stats.lives', { count: stats.lives })}
              ariaLabel={`${stats.lives} ${t('questMap.stats.lives', {
                count: stats.lives,
              })}`}
            />
            <StatBubble
              tone="gold"
              glyph="xp"
              big={formatNumber(stats.weeklyXp)}
              small={t('questMap.stats.weeklyXp')}
              ariaLabel={`${stats.weeklyXp} ${t('questMap.stats.weeklyXp')}`}
            />
            <StatBubble
              tone="coral"
              glyph="flame"
              big={stats.streak}
              small={t('questMap.stats.streak', { count: stats.streak })}
              ariaLabel={`${stats.streak} ${t('questMap.stats.streak', {
                count: stats.streak,
              })}`}
            />
          </div>
        </header>

        <div
          className="relative"
          style={{ minHeight: Math.max(units.length, 1) * 110 + 80 }}
        >
          <QuestPath rows={units.length} />
          <ol className="relative z-10 flex flex-col gap-7">
            {units.map((unit, index) => (
              <QuestUnitRow key={unit.id} unit={unit} index={index} />
            ))}
          </ol>
        </div>
      </section>

      <aside
        aria-label="Vulpița și lecțiile de azi"
        className="flex flex-col gap-4 overflow-y-auto border-l-[3px] border-outline-variant bg-surface-container-lowest px-5 py-5"
      >
        <VulpitaPanel mood={mood} remainingLessons={remainingLessons} />

        <TodaysLessons lessons={lessons} emptyHref={ROUTES.STUDENT.ACTIVITIES} />
        <StudentActivitiesLane activities={activities} />

        <div className="mt-auto">
          <ChunkyButton
            href={ROUTES.STUDENT.ACTIVITIES}
            variant="green"
            size="lg"
            full
            icon="Play"
          >
            {t('questMap.actions.playNow')}
          </ChunkyButton>
        </div>
      </aside>
    </div>
  )
}
