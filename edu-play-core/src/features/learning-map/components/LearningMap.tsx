'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ActionIcon } from '@mantine/core'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { ProgressBar } from '@/shared/components/ui/ProgressBar'
import { TopAppBar } from '@/shared/components/layout/TopAppBar'
import { BottomNavBar } from '@/shared/components/layout/BottomNavBar'
import { Button, Card, Vulpita } from '@/shared/components/ui/kit'
import { ROLE_NAV_CONFIG } from '@/config/navigation'
import { ROUTES } from '@/shared/lib/constants/routes'
import { formatNumber } from '@/lib/i18n/formatters'
import {
  fadeInUp,
  motionPreset,
  staggerContainer,
  staggerItem,
  transitions,
} from '@/config/animations'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StageStatus = 'locked' | 'current' | 'completed'

export interface StageLesson {
  id: string
  title: string
  description?: string
  href?: string
}

export interface LearningStage {
  id: string
  name: string
  status: StageStatus
  icon: IconName
  stageNumber: number
  lessons: StageLesson[]
  stars?: number
  maxStars?: number
  decorIcon?: IconName
  color?: 'primary' | 'gold' | 'blue'
}

export interface LearningMapProfile {
  full_name: string
  avatar_url?: string | null
  xp?: number
  maxXp?: number
  level?: number
  levelLabel?: string
  totalStars?: number
}

export interface LearningMapProps {
  profile: LearningMapProfile
  stages: LearningStage[]
  overallProgress?: number
  nextLesson?: {
    id: string
    title: string
    description: string
    href: string
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOP_TABS = [
  { label: 'Acasă', href: ROUTES.STUDENT.DASHBOARD, active: false },
  { label: 'Jocuri', href: ROUTES.STUDENT.ACTIVITIES, active: false },
  { label: 'Progres', href: ROUTES.STUDENT.PROGRESS, active: false },
  { label: 'Premii', href: ROUTES.STUDENT.REWARDS, active: false },
]

const STUDENT_BOTTOM_NAV_ITEMS = ROLE_NAV_CONFIG.student.bottomNavItems ?? []

const STAGE_COLOR_MAP = {
  primary: {
    bg: 'bg-primary',
    border: 'border-primary',
    label: 'bg-primary-soft text-primary-deep',
    text: 'text-primary-deep',
    iconBg: 'bg-primary-soft',
    face: 'var(--color-primary)',
    ink: 'var(--color-on-primary)',
    borderColor: 'var(--color-primary)',
  },
  gold: {
    bg: 'bg-gold',
    border: 'border-gold',
    label: 'bg-gold-soft text-gold-deep',
    text: 'text-gold-deep',
    iconBg: 'bg-gold-soft',
    face: 'var(--color-gold)',
    ink: 'var(--color-gold-deep)',
    borderColor: 'var(--color-gold)',
  },
  blue: {
    bg: 'bg-blue',
    border: 'border-blue',
    label: 'bg-blue-soft text-blue-deep',
    text: 'text-blue-deep',
    iconBg: 'bg-blue-soft',
    face: 'var(--color-blue)',
    ink: 'var(--color-blue-deep)',
    borderColor: 'var(--color-blue)',
  },
} as const

const CURRENT_STAGE_NODE_SIZE = 'clamp(96px, 14vw, 112px)'
const COMPLETED_STAGE_NODE_SIZE = 'clamp(88px, 12vw, 96px)'
type StageColorTokens = (typeof STAGE_COLOR_MAP)[keyof typeof STAGE_COLOR_MAP]

function stageAccentClass(color?: LearningStage['color']) {
  if (color === 'gold') return 'bg-gold'
  if (color === 'blue') return 'bg-blue'
  return 'bg-primary'
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function StageStars({ stars = 0, maxStars = 3 }: { stars?: number; maxStars?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: maxStars }).map((_, i) => (
        <Icon
          key={i}
          name="Star"
          weight={i < stars ? 'fill' : 'regular'}
          className={i < stars ? 'text-gold-deep text-lg' : 'text-outline-variant text-lg'}
          size={14}
        />
      ))}
    </div>
  )
}

function LockedStageNode({ stage, index }: { stage: LearningStage; index: number }) {
  const reducedMotion = useReducedMotion()
  const offsetClass = index % 2 === 0 ? 'md:ml-40' : 'md:-ml-32'

  return (
    <motion.div
      variants={staggerItem}
      className={`relative flex flex-col items-center ${offsetClass}`}
    >
      {stage.stageNumber > 0 && (
        <div className="absolute -top-16 text-center">
          <span className="bg-surface-container px-4 py-1 rounded-full text-lg font-bold uppercase tracking-widest">
            Etapa {stage.stageNumber}
          </span>
          <h2 className="text-lg font-bold text-on-surface mt-1 font-headline">{stage.name}</h2>
        </div>
      )}
      <div className="w-20 h-20 md:w-24 md:h-24 bg-surface-container rounded-full flex items-center justify-center border-4 border-outline-variant opacity-60">
        <Icon name="Lock" className="text-outline" size={32} />
      </div>
      {stage.decorIcon && (
        <motion.div
          variants={motionPreset('float', reducedMotion ?? false)}
          animate="animate"
          className="absolute -right-12 top-0"
        >
          <div className="bg-surface-container-lowest p-3 rounded-lg shadow-soft-sm border-2 border-surface-container">
            <Icon name={stage.decorIcon} className="text-primary" size={32} />
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

function CurrentStageNode({ stage }: { stage: LearningStage }) {
  const reducedMotion = useReducedMotion()
  const colors = STAGE_COLOR_MAP[stage.color ?? 'primary']
  const firstLesson = stage.lessons[0]
  const href = firstLesson?.href
  const nodeStyles = {
    root: {
      position: 'relative' as const,
      zIndex: 10,
      width: CURRENT_STAGE_NODE_SIZE,
      height: CURRENT_STAGE_NODE_SIZE,
      minWidth: 64,
      minHeight: 64,
      border: '8px solid var(--color-surface-container-lowest)',
      background: colors.face,
      color: colors.ink,
      boxShadow: 'var(--shadow-soft)',
    },
  }
  const nodeIcon = (
    <Icon
      name={stage.icon}
      weight="fill"
      style={{ color: colors.ink }}
      size={40}
    />
  )

  return (
    <motion.div variants={staggerItem} className="relative flex flex-col items-center">
      <div className="absolute -top-16 text-center">
        <span className={`${colors.label} px-4 py-1 rounded-full text-lg font-bold uppercase tracking-widest`}>
          Etapa {stage.stageNumber}
        </span>
        <h2 className="text-xl font-bold text-on-surface mt-1 font-headline">{stage.name}</h2>
      </div>

      <motion.div
        className={href ? 'relative cursor-pointer' : 'relative cursor-default'}
      >
        {href ? (
          <ActionIcon
            component={Link}
            href={href}
            aria-label={`Etapa curentă: ${stage.name}`}
            radius="50%"
            size={96}
            variant="filled"
            styles={nodeStyles}
          >
            {nodeIcon}
          </ActionIcon>
        ) : (
          <div
            aria-disabled="true"
            className="flex items-center justify-center rounded-full"
            style={nodeStyles.root}
          >
            {nodeIcon}
          </div>
        )}

        {/* Current-position badge */}
        <motion.div
          variants={motionPreset('float', reducedMotion ?? false)}
          animate="animate"
          className="absolute -top-10 left-1/2 -translate-x-1/2 z-20"
        >
          <div className="bg-gold text-gold-deep font-bold px-4 py-1 rounded-full text-lg shadow-soft-sm whitespace-nowrap">
            Ești aici!
          </div>
          <div className="w-3 h-3 bg-gold rotate-45 mx-auto -mt-1" />
        </motion.div>
      </motion.div>

      {stage.decorIcon && (
        <div className={`absolute -left-20 top-4 w-12 h-12 ${colors.iconBg} rounded-full flex items-center justify-center`}>
          <Icon name={stage.decorIcon} className={colors.text} />
        </div>
      )}
    </motion.div>
  )
}

function CompletedStageNode({
  stage,
  index,
  onSelect,
}: {
  stage: LearningStage
  index: number
  onSelect: (stage: LearningStage) => void
}) {
  const colors = STAGE_COLOR_MAP[stage.color ?? 'gold']
  const offsetClass = index % 2 === 0 ? 'md:-ml-32' : 'md:ml-32'

  return (
    <motion.div
      variants={staggerItem}
      className={`relative flex flex-col items-center ${offsetClass}`}
    >
      {stage.stageNumber > 0 && (
        <div className="absolute -top-16 text-center">
          <span className={`${colors.label} px-4 py-1 rounded-full text-lg font-bold uppercase tracking-widest`}>
            Etapa {stage.stageNumber}
          </span>
          <h2 className="text-lg font-bold text-on-surface mt-1 font-headline">{stage.name}</h2>
        </div>
      )}

      <ActionIcon
        onClick={() => onSelect(stage)}
        type="button"
        aria-label={`Etapa completată: ${stage.name}`}
        radius="50%"
        size={88}
        variant="default"
        styles={{
          root: {
            width: COMPLETED_STAGE_NODE_SIZE,
            height: COMPLETED_STAGE_NODE_SIZE,
            minWidth: 64,
            minHeight: 64,
            background: 'var(--color-surface-container-lowest)',
            border: `4px solid ${colors.borderColor}`,
            boxShadow: 'var(--shadow-soft-sm)',
            color: colors.borderColor,
          },
        }}
      >
        <span className="flex flex-col items-center">
          <StageStars stars={stage.stars} maxStars={stage.maxStars} />
          <Icon
            name={stage.icon}
            className={colors.text}
            size={28}
          />
        </span>
      </ActionIcon>

      {stage.decorIcon && (
        <div className={`absolute -right-24 top-0 w-16 h-16 ${colors.iconBg} rounded-full flex items-center justify-center border-2 border-dashed ${colors.border}/30`}>
          <Icon name={stage.decorIcon} className={colors.text} size={24} />
        </div>
      )}
    </motion.div>
  )
}

function StageDetailPanel({
  stage,
  onClose,
}: {
  stage: LearningStage
  onClose: () => void
}) {
  const colors = STAGE_COLOR_MAP[stage.color ?? 'primary']

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0, transition: transitions.smooth }}
      exit={{ opacity: 0, y: 40, transition: transitions.smooth }}
      className="fixed bottom-32 md:bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-40 lg:left-auto lg:right-10 lg:translate-x-0 lg:w-80"
    >
      <div className="bg-surface-container-lowest rounded-xl shadow-soft overflow-hidden">
        <div className={`h-1 rounded-full ${stageAccentClass(stage.color)}`} />
        <div className="p-6">
          <StageDetailHeader stage={stage} colors={colors} onClose={onClose} />
          <StageCompletionSummary stage={stage} />
          <StageLessonList stage={stage} colors={colors} />
          <StageDetailAction stage={stage} />
        </div>
      </div>
    </motion.div>
  )
}

function StageDetailHeader({
  stage,
  colors,
  onClose,
}: {
  stage: LearningStage
  colors: StageColorTokens
  onClose: () => void
}) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <span className={`${colors.label} px-4 py-0.5 rounded-full text-lg font-bold uppercase tracking-widest`}>
          Etapa {stage.stageNumber}
        </span>
        <h3 className="font-bold text-lg font-headline mt-1">{stage.name}</h3>
      </div>
      <ActionIcon
        onClick={onClose}
        type="button"
        variant="subtle"
        radius="50%"
        size={64}
        aria-label="Închide detalii"
        styles={{
          root: {
            color: 'var(--color-on-surface)',
          },
        }}
      >
        <Icon name="X" size={20} />
      </ActionIcon>
    </div>
  )
}

function StageCompletionSummary({ stage }: { stage: LearningStage }) {
  if (stage.status !== 'completed') return null

  return (
    <div className="flex items-center gap-2 mb-3">
      <StageStars stars={stage.stars} maxStars={stage.maxStars} />
      <span className="text-lg text-on-surface-variant font-medium">
        {stage.stars}/{stage.maxStars} stele
      </span>
    </div>
  )
}

function StageLessonList({
  stage,
  colors,
}: {
  stage: LearningStage
  colors: StageColorTokens
}) {
  if (stage.lessons.length === 0) return null

  const isCompleted = stage.status === 'completed'

  return (
    <ul className="space-y-2 mb-4">
      {stage.lessons.map((lesson) => (
        <li key={lesson.id} className="flex items-center gap-3">
          <Icon
            name={isCompleted ? 'CheckCircle' : 'PlayCircle'}
            weight={isCompleted ? 'fill' : 'regular'}
            className={isCompleted ? 'text-primary-deep' : colors.text}
            size={20}
          />
          <span className="text-lg text-on-surface">{lesson.title}</span>
        </li>
      ))}
    </ul>
  )
}

function StageDetailAction({ stage }: { stage: LearningStage }) {
  const href = stage.lessons[0]?.href

  if (!href) return null

  if (stage.status === 'current') {
    return (
      <Button
        href={href}
        mode="kid"
        size="lg"
        tone="lime"
        fullWidth
      >
        <Icon name="Play" weight="fill" />
        Începe jocul
      </Button>
    )
  }

  if (stage.status === 'completed') {
    return (
      <Button
        href={href}
        mode="kid"
        variant="ghost"
        size="lg"
        tone="cream"
        fullWidth
      >
        <Icon name="ArrowCounterClockwise" />
        Joacă din nou
      </Button>
    )
  }

  return null
}

function NextLessonPanel({
  nextLesson,
}: {
  nextLesson: { id: string; title: string; description: string; href: string }
}) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className="fixed bottom-32 md:bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-40 lg:left-auto lg:right-10 lg:translate-x-0 lg:w-80"
    >
      <div className="bg-surface-container-lowest rounded-xl shadow-soft overflow-hidden">
        <div className="h-1 bg-primary rounded-full" />
        <div className="p-6">
        <h3 className="font-bold text-lg mb-2 font-headline">Următoarea lecție</h3>
        <p className="text-on-surface-variant text-lg mb-4">{nextLesson.description}</p>
        <Button
          href={nextLesson.href}
          mode="kid"
          size="lg"
          tone="lime"
          fullWidth
        >
          <Icon name="Play" weight="fill" />
          Începe jocul
        </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Decorative SVG Path ──────────────────────────────────────────────────────

function MapPathSvg() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none opacity-15 flex justify-center translate-y-20">
      <svg
        className="w-full max-w-xl"
        viewBox="0 0 400 1200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 200 0C200 100 350 150 350 300C350 450 50 500 50 650C50 800 350 850 350 1000C350 1150 200 1200 200 1200"
          stroke="url(#mapGradient)"
          strokeWidth="60"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="mapGradient" x1="200" y1="0" x2="200" y2="1200" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--color-primary)" />
            <stop offset="0.5" stopColor="var(--color-blue)" />
            <stop offset="1" stopColor="var(--color-gold)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

function EmptyPathState() {
  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className="relative z-10 w-full max-w-xl py-6 pb-32 md:py-10"
    >
      <Card
        mode="kid"
        tone="surface"
        padding="lg"
        className="flex flex-col items-center gap-5 border border-outline-variant bg-surface-container-lowest text-center"
      >
        <Vulpita mood="happy" size={112} />
        <div className="space-y-2">
          <h2 className="font-headline text-2xl font-bold text-on-surface">
            Nu ai un parcurs activ încă
          </h2>
          <p className="text-lg text-on-surface-variant">
            Întoarce-te acasă și vezi ce jocuri te așteaptă.
          </p>
        </div>
        <Button
          mode="kid"
          href={ROUTES.STUDENT.DASHBOARD}
          variant="primary"
          size="lg"
        >
          <Icon name="House" size="sm" aria-hidden />
          Acasă
        </Button>
      </Card>
    </motion.div>
  )
}

// ─── Background Decorations ───────────────────────────────────────────────────

function BackgroundDecorations() {
  return null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LearningMap({
  profile,
  stages,
  overallProgress = 0,
  nextLesson,
}: LearningMapProps) {
  const [selectedStage, setSelectedStage] = useState<LearningStage | null>(null)
  const hasStages = stages.length > 0

  // Sort stages so the path flows from bottom (earliest) to top (latest),
  // matching the Stitch design where stage 1 is at the bottom.
  const sortedStages = [...stages].sort((a, b) => b.stageNumber - a.stageNumber)

  const handleStageSelect = (stage: LearningStage) => {
    setSelectedStage((prev) => (prev?.id === stage.id ? null : stage))
  }

  return (
    <div
      data-testid="learning-map-shell"
      aria-label="Harta de învățare"
      className="relative flex min-h-screen flex-col overflow-x-hidden bg-surface pb-28 md:pb-0"
    >
      {/* Top App Bar */}
      <TopAppBar
          showLogo
          tabs={TOP_TABS}
          profile={{
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          }}
        >
          {/* Stars badge in top bar */}
          {profile.totalStars != null && (
            <div className="bg-surface-container px-4 py-2 rounded-full flex items-center gap-2">
              <Icon name="Sparkle" weight="fill" className="text-gold-deep" />
              <span className="font-bold text-on-surface">
                {formatNumber(profile.totalStars)}
              </span>
            </div>
          )}
        </TopAppBar>

        {/* Main Content Area */}
        <section className="relative flex flex-1 flex-col items-center overflow-x-hidden overflow-y-auto">
          <div className="flex w-full max-w-4xl flex-col items-center px-4 py-8 md:py-12">
            {/* Progress Header Card */}
            <motion.div
              variants={fadeInUp}
              initial="initial"
              animate="animate"
              className="relative z-10 mb-8 flex w-full flex-col justify-between gap-5 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-soft-sm md:mb-12 md:flex-row md:items-center md:p-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary-soft rounded-full flex items-center justify-center shrink-0">
                  <Icon name="MapTrifold" weight="fill" className="text-primary-deep" size={30} />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold font-headline text-on-surface leading-tight">
                    Călătoria învățării
                  </h1>
                  <p className="text-on-surface-variant text-lg">Continuă expediția ta!</p>
                </div>
              </div>
              <div className="flex-1 max-w-md">
                <ProgressBar
                  value={overallProgress}
                  max={100}
                  label="Progres general"
                  showPercent
                  color="bg-primary"
                  height="h-4"
                />
              </div>
            </motion.div>

            {/* 2.5D Path Map */}
            <div className="w-full relative flex flex-col items-center">
              {hasStages ? <MapPathSvg /> : null}

              {/* Stage Nodes */}
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className={hasStages
                  ? 'relative z-10 flex w-full flex-col items-center gap-24 py-10 md:gap-32'
                  : 'relative z-10 flex w-full flex-col items-center py-2 md:py-6'}
              >
                {!hasStages ? <EmptyPathState /> : sortedStages.map((stage, index) => {
                  switch (stage.status) {
                    case 'locked':
                      return <LockedStageNode key={stage.id} stage={stage} index={index} />
                    case 'current':
                      return (
                        <CurrentStageNode
                          key={stage.id}
                          stage={stage}
                        />
                      )
                    case 'completed':
                      return (
                        <CompletedStageNode
                          key={stage.id}
                          stage={stage}
                          index={index}
                          onSelect={handleStageSelect}
                        />
                      )
                    default:
                      return null
                  }
                })}
              </motion.div>
            </div>
          </div>

          {/* Bottom Action Panel */}
          <AnimatePresence mode="wait">
            {selectedStage ? (
              <StageDetailPanel
                key={`detail-${selectedStage.id}`}
                stage={selectedStage}
                onClose={() => setSelectedStage(null)}
              />
            ) : nextLesson ? (
              <NextLessonPanel key="next-lesson" nextLesson={nextLesson} />
            ) : null}
          </AnimatePresence>
        </section>

      {/* Background Decorations */}
      <BackgroundDecorations />
      <BottomNavBar items={STUDENT_BOTTOM_NAV_ITEMS} mode="kid" />

    </div>
  )
}
