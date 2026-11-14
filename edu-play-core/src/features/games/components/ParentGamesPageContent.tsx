'use client'

import { useState } from 'react'
import { Button } from '@mantine/core'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Icon } from '@/shared/components/ui/Icon';
import { FilterSelect } from '@/shared/components/ui/kit'
import { staggerContainer, staggerItem } from '@/config/animations'
import { ROUTES } from '@/shared/lib/constants'
import {
  getCategoryConfig,
  type CategoryConfig,
  type Game,
  type GameProgress,
  type GameStatus,
  type GameWithProgress,
} from '../types'

interface ChildProgress {
  id: string
  name: string
  avatarUrl?: string | null
  gamesWithProgress: GameWithProgress[]
}

interface ParentGamesPageContentProps {
  childProgress: ChildProgress[]
  catalogGames?: Game[]
}

export function ParentGamesPageContent({
  childProgress,
  catalogGames = [],
}: ParentGamesPageContentProps) {
  const [selectedChildId, setSelectedChildId] = useState<string>(
    childProgress[0]?.id || ''
  )

  const selectedChild = childProgress.find((c) => c.id === selectedChildId)
  const childGamesWithProgress = selectedChild?.gamesWithProgress || []
  const progressByGameId = new Map(
    childGamesWithProgress.map((game) => [game.id, game.progress] as const),
  )
  const gamesWithProgress = catalogGames.length === 0
    ? childGamesWithProgress
    : catalogGames.map((game) => ({
        ...game,
        progress: progressByGameId.get(game.id) ?? null,
      }))

  // Calculate stats
  const completedGames = gamesWithProgress.filter(
    (g) => g.progress?.status === 'completed'
  ).length
  const inProgressGames = gamesWithProgress.filter(
    (g) => g.progress?.status === 'in_progress'
  ).length
  const totalPlayTime = gamesWithProgress.reduce(
    (sum, g) => sum + (g.progress?.time_spent || 0),
    0
  )
  const gamesWithNumericScores = gamesWithProgress.filter(
    (g) => typeof g.progress?.score === 'number'
  )
  const averageScore =
    gamesWithNumericScores.length > 0
      ? Math.round(
          gamesWithNumericScores.reduce(
            (sum, g) => sum + (g.progress?.score ?? 0),
            0
          ) / gamesWithNumericScores.length
        )
      : 0

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-1">
            Progresul la Jocuri
          </h2>
          <p className="text-on-surface-variant">
            Urmărește progresul copilului tău și joacă orice activitate din bibliotecă
          </p>
        </div>

        {/* Child Selector */}
        {childProgress.length > 1 && (
          <FilterSelect
            ariaLabel="Selectează copilul"
            fullWidth
            className="shrink-0 md:w-[250px] md:max-w-[250px]"
            width="100%"
            value={selectedChildId}
            onChange={setSelectedChildId}
            options={childProgress.map((child) => ({
              value: child.id,
              label: child.name,
            }))}
            size="md"
            radius="md"
          />
        )}
      </div>

      {/* Selected Child Info */}
      {selectedChild && (
        <div className="bg-surface-container-lowest border border-outline-variant shadow-soft-sm rounded-xl p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold shrink-0">
              {selectedChild.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg">
                {selectedChild.name}
              </p>
              <p className="text-on-surface-variant text-sm">
                {gamesWithProgress.length} jocuri disponibile
              </p>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4 md:gap-6 justify-start lg:justify-end flex-1 w-full" style={{ flexBasis: '320px' }}>
              <div className="text-center min-w-[88px]">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Icon name="Trophy" size={18} className="text-primary" />
                  <span className="font-bold text-2xl">
                    {completedGames}
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant">
                  Completate
                </span>
              </div>
              <div className="text-center min-w-[88px]">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Icon name="GameController" size={18} className="text-primary" />
                  <span className="font-bold text-2xl">
                    {inProgressGames}
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant">
                  În progres
                </span>
              </div>
              <div className="text-center min-w-[88px]">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Icon name="Clock" size={18} className="text-on-surface-variant" />
                  <span className="font-bold text-2xl">
                    {formatTime(totalPlayTime)}
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant">
                  Timp jucat
                </span>
              </div>
              <div className="text-center min-w-[88px]">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Icon name="Star" size={18} className="text-gold" />
                  <span className="font-bold text-2xl">
                    {averageScore}%
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant">
                  Scor mediu
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Games Grid */}
      {gamesWithProgress.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant shadow-soft-sm flex flex-col items-center justify-center rounded-xl py-16">
          <Icon name="GameController" size={64} className="text-outline-variant mb-4" />
          <h3 className="text-lg font-semibold text-on-surface-variant mb-2">
            Nu există jocuri disponibile
          </h3>
          <p className="text-outline">
            Jocurile vor apărea aici când sunt publicate în bibliotecă
          </p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {gamesWithProgress.map((game, index) => (
            <ParentGameCard key={game.id} game={game} index={index} />
          ))}
        </motion.div>
      )}
    </div>
  )
}

interface ParentGameCardProps {
  game: GameWithProgress
  index: number
}

interface StatusView {
  label: string
  className: string
}

const STATUS_VIEW: Record<GameStatus, StatusView> = {
  completed: {
    label: 'Completat',
    className: 'bg-primary-soft text-primary-deep',
  },
  in_progress: {
    label: 'În progres',
    className: 'bg-blue-soft text-blue-deep',
  },
  not_started: {
    label: 'Neînceput',
    className: 'bg-surface-container text-on-surface',
  },
}

function getStatusView(progress: GameProgress | null): StatusView {
  return STATUS_VIEW[progress?.status ?? 'not_started']
}

function hasStarted(progress: GameProgress | null): progress is GameProgress {
  return Boolean(progress && progress.status !== 'not_started')
}

interface ParentGameCardHeaderProps {
  categoryConfig: CategoryConfig
  status: StatusView
}

function ParentGameCardHeader({
  categoryConfig,
  status,
}: ParentGameCardHeaderProps) {
  return (
    <div
      className="h-20 flex items-center justify-center relative"
      style={{ backgroundColor: categoryConfig.bgColor }}
    >
      <Icon
        name={categoryConfig.icon}
        size={40}
        weight="fill"
        style={{ color: categoryConfig.color }}
        aria-hidden
      />

      <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded font-medium ${status.className}`}>
        {status.label}
      </span>
    </div>
  )
}

interface GameCategoryRowProps {
  categoryConfig: CategoryConfig
  difficultyLevel: number | null
}

function GameCategoryRow({
  categoryConfig,
  difficultyLevel,
}: GameCategoryRowProps) {
  const filledStars = difficultyLevel ?? 1

  return (
    <div className="flex items-center gap-2 mb-3 text-xs">
      <span className={`px-2 py-0.5 rounded font-medium ${categoryConfig.badgeClass}`}>
        {categoryConfig.label}
      </span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, index) => (
          <Icon
            key={index}
            name="Star"
            size={10}
            weight={index < filledStars ? 'fill' : 'regular'}
            className={
              index < filledStars ? 'text-gold-container' : 'text-outline-variant'
            }
          />
        ))}
      </div>
    </div>
  )
}

interface ProgressScoreProps {
  color: string
  score: number | null
}

function ProgressScore({ color, score }: ProgressScoreProps) {
  if (score === null) {
    return null
  }

  return (
    <div className="flex justify-between items-center mb-2">
      <span className="text-xs text-on-surface-variant">Scor</span>
      <span className="font-bold" style={{ color }}>
        {score}%
      </span>
    </div>
  )
}

function CompletedProgressBar({ status }: { status: GameStatus }) {
  if (status !== 'completed') {
    return null
  }

  return (
    <div className="h-2 bg-surface-container rounded-full overflow-hidden mb-2">
      <div className="h-full bg-primary rounded-full w-full" />
    </div>
  )
}

function ProgressStats({ progress }: { progress: GameProgress }) {
  return (
    <div className="flex justify-between items-center text-xs text-on-surface-variant">
      {progress.time_spent ? (
        <div className="flex items-center gap-1">
          <Icon name="Clock" size={12} />
          <span>{Math.floor(progress.time_spent / 60)}m jucat</span>
        </div>
      ) : null}
      {progress.attempts ? <span>{progress.attempts} încercări</span> : null}
    </div>
  )
}

interface GameProgressDetailsProps {
  categoryConfig: CategoryConfig
  progress: GameProgress | null
}

function GameProgressDetails({
  categoryConfig,
  progress,
}: GameProgressDetailsProps) {
  if (!hasStarted(progress)) {
    return (
      <p className="text-xs text-outline text-center py-2">
        Încă nu a jucat acest joc
      </p>
    )
  }

  return (
    <div>
      <ProgressScore color={categoryConfig.color} score={progress.score} />
      <CompletedProgressBar status={progress.status} />
      <ProgressStats progress={progress} />
    </div>
  )
}

function ParentGameLaunchButton({ game }: { game: GameWithProgress }) {
  return (
    <Button
      component={Link}
      href={game.launchHref ?? ROUTES.PLAY.ACTIVITY(game.id)}
      color="purple"
      fullWidth
      h={44}
      mt="md"
      radius="md"
      rightSection={<Icon name="Play" size={16} weight="fill" />}
      classNames={{
        root: 'text-on-primary hover:bg-primary-dim',
        label: 'text-sm font-bold',
      }}
    >
      Joacă
    </Button>
  )
}

function ParentGameCard({ game, index }: ParentGameCardProps) {
  const categoryConfig = getCategoryConfig(game.category)
  const status = getStatusView(game.progress)

  return (
    <motion.div
      variants={staggerItem}
      custom={index}
      className="bg-surface-container-lowest border border-outline-variant shadow-soft-sm overflow-hidden rounded-xl"
    >
      <ParentGameCardHeader categoryConfig={categoryConfig} status={status} />

      <div className="p-4">
        <p className="font-bold text-sm truncate mb-2">
          {game.title}
        </p>

        <GameCategoryRow
          categoryConfig={categoryConfig}
          difficultyLevel={game.difficulty_level}
        />
        <GameProgressDetails
          categoryConfig={categoryConfig}
          progress={game.progress}
        />
        <ParentGameLaunchButton game={game} />
      </div>
    </motion.div>
  )
}
