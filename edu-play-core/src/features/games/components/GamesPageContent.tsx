'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '@/shared/components/ui/Icon';
import Link from 'next/link'
import { ROUTES } from '@/shared/lib/constants'
import { fadeIn } from '@/config/animations'
import { CategoryFilter } from './CategoryFilter'
import { GameGrid, GameSection } from './GameGrid'
import type { GameWithProgress, GameCategory, Game } from '../types'

interface GamesPageContentProps {
  games: GameWithProgress[]
  assignedGames?: Game[]
  studentName?: string
  stats?: {
    totalStars: number
    completedGames: number
  }
}

export function GamesPageContent({
  games,
  assignedGames = [],
  studentName,
  stats,
}: GamesPageContentProps) {
  const [selectedCategory, setSelectedCategory] = useState<GameCategory | 'all'>('all')

  // Filter games by category
  const filteredGames = useMemo(() => {
    if (selectedCategory === 'all') {
      return games
    }
    return games.filter((game) => game.category === selectedCategory)
  }, [games, selectedCategory])

  // Games in progress (max 2)
  const inProgressGames = useMemo(() => {
    return games
      .filter((game) => game.progress?.status === 'in_progress')
      .slice(0, 2)
  }, [games])

  // Assigned games with progress
  const assignedGamesWithProgress = useMemo(() => {
    const assignedById = new Map(assignedGames.map((game) => [game.id, game]))
    return games
      .filter((game) => assignedById.has(game.id))
      .map((game) => ({
        ...game,
        launchHref: assignedById.get(game.id)?.launchHref ?? game.launchHref,
      }))
  }, [games, assignedGames])

  // Calculate stats if not provided
  const displayStats = useMemo(() => {
    if (stats) return stats

    const completedGames = games.filter((g) => g.progress?.status === 'completed').length
    const totalStars = games.reduce((sum, g) => {
      if (g.progress?.status === 'completed' && g.progress.score) {
        // Calculate stars based on score (3 stars for 90%+, 2 for 70%+, 1 for 50%+)
        const score = g.progress.score
        if (score >= 90) return sum + 3
        if (score >= 70) return sum + 2
        if (score >= 50) return sum + 1
      }
      return sum
    }, 0)

    return { totalStars, completedGames }
  }, [games, stats])

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={ROUTES.STUDENT.DASHBOARD}
            className="inline-flex items-center gap-2 px-4 h-16 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors text-lg focus-ring"
          >
            <Icon name="ArrowLeft" />
            Înapoi
          </Link>
          <h1 className="text-2xl font-bold text-on-surface">
            Toate jocurile
          </h1>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-gold-soft px-4 py-2 rounded-xl shadow-soft">
            <Icon name="Star" size={24} className="text-gold" />
            <span className="font-bold text-xl text-on-surface">
              {displayStats.totalStars}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-primary-container/30 px-4 py-2 rounded-xl shadow-soft">
            <Icon name="Trophy" size={24} className="text-primary" />
            <span className="font-bold text-xl text-on-surface">
              {displayStats.completedGames}
            </span>
          </div>
        </div>
      </div>

      {/* Welcome message */}
      {studentName && (
        <p className="text-lg text-on-surface-variant mb-6">
          Bună, {studentName}! Alege un joc ca să începi să înveți.
        </p>
      )}

      {/* Category Filter */}
      <div className="mb-8">
        <CategoryFilter
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      </div>

      {/* Continue Playing Section */}
      {inProgressGames.length > 0 && selectedCategory === 'all' && (
        <GameSection
          title="Continuă să joci"
          games={inProgressGames}
          maxItems={2}
        />
      )}

      {/* Assigned Games Section */}
      {assignedGamesWithProgress.length > 0 && selectedCategory === 'all' && (
        <GameSection
          title="Jocuri de la profesor"
          games={assignedGamesWithProgress}
        />
      )}

      {/* All Games Grid */}
      <div>
        <p className="text-2xl font-bold text-on-surface mb-4 flex items-center gap-2">
          {selectedCategory === 'all' ? (
            <>Toate jocurile ({filteredGames.length})</>
          ) : (
            <>Jocuri ({filteredGames.length})</>
          )}
        </p>
        <GameGrid
          games={filteredGames}
          emptyMessage="Nu există jocuri în această categorie"
        />
      </div>
    </motion.div>
  )
}
