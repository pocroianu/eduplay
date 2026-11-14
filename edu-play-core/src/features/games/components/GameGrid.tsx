'use client'

import { motion } from 'framer-motion'
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { staggerContainer } from '@/config/animations'
import { GameCard } from './GameCard'
import type { GameWithProgress } from '../types'

interface GameGridProps {
  games: GameWithProgress[]
  emptyMessage?: string
}

export function GameGrid({ games, emptyMessage = 'Nu există jocuri în această categorie' }: GameGridProps) {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-surface-container-lowest rounded-2xl shadow-soft">
        <Icon name="GameController" size={64} className="text-outline-variant mb-4" />
        <p className="text-on-surface-variant text-lg text-center">
          {emptyMessage}
        </p>
      </div>
    )
  }

  return (
    <motion.div
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5 lg:gap-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {games.map((game, index) => (
        <GameCard key={game.id} game={game} index={index} />
      ))}
    </motion.div>
  )
}

interface GameSectionProps {
  title: string
  icon?: IconName
  games: GameWithProgress[]
  showIfEmpty?: boolean
  emptyMessage?: string
  maxItems?: number
}

export function GameSection({
  title,
  icon,
  games,
  showIfEmpty = false,
  emptyMessage,
  maxItems,
}: GameSectionProps) {
  const displayGames = maxItems ? games.slice(0, maxItems) : games

  if (games.length === 0 && !showIfEmpty) {
    return null
  }

  return (
    <div className="mb-8">
      <p className="text-2xl font-bold text-on-surface mb-4 flex items-center gap-2">
        {icon && <Icon name={icon} size={24} weight="fill" aria-hidden />}
        {title}
        {games.length > 0 && (
          <span className="text-lg text-on-surface-variant font-normal">
            ({games.length})
          </span>
        )}
      </p>
      <GameGrid games={displayGames} emptyMessage={emptyMessage} />
    </div>
  )
}
