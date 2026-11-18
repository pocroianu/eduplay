'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { getCategoryConfig } from '@/features/games'
import { ROUTES } from '@/shared/lib/constants/routes'
import { Icon } from '@/shared/components/ui/Icon';
import {
  fadeInUp,
  staggerContainer,
  staggerItem,
} from '@/config/animations'
import { StudentActivitiesLane, type StudentActivityCard } from './StudentActivitiesLane'

export interface PreschoolDashboardProps {
  profile: {
    full_name: string
    avatar_url?: string | null
  }
  totalStars: number
  completedCount: number
  dailyStarGoal: number
  inProgressGames: Array<{
    id: string
    game_id: string
    status: string
    score: number | null
  }>
  progressEntries: Array<{
    id: string
    game_id: string
    status: string
    score: number | null
    last_played_at?: string | null
    completed_at?: string | null
    attempts?: number
  }>
  assignments: Array<{
    id: string
    launchHref?: string
    games: {
      id: string
      title: string
      category: string | null
      difficulty_level: number | null
    } | null
  }>
  allGames: Array<{
    id: string
    title: string
    category: string | null
    difficulty_level: number | null
    thumbnail_url?: string | null
  }>
  activities?: StudentActivityCard[]
  progressMap: Record<
    string,
    { id: string; game_id: string; status: string; score: number | null; attempts: number }
  >
}

export function PreschoolDashboard({
  totalStars,
  dailyStarGoal,
  allGames,
  progressMap,
  assignments,
  activities = [],
}: PreschoolDashboardProps) {
  const { t } = useTranslation('student')
  const featuredAssignment = assignments.find((a) => a.games !== null)
  const featuredAssignmentGame = featuredAssignment?.games
  const featuredGame = featuredAssignmentGame
    ? allGames.find((g) => g.id === featuredAssignmentGame.id) ?? { ...featuredAssignmentGame, thumbnail_url: null }
    : allGames[0] ?? null
  const featuredHref =
    featuredAssignment?.launchHref ??
    (featuredGame ? ROUTES.PLAY.ACTIVITY(featuredGame.id) : ROUTES.STUDENT.ACTIVITIES)

  const newGames = allGames.slice(0, 4)

  const favorites = Object.values(progressMap)
    .filter((p) => p.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 2)
    .map((p) => {
      const game = allGames.find((g) => g.id === p.game_id)
      return game ? { ...game, score: p.score, progress: p } : null
    })
    .filter(Boolean) as Array<
    (typeof allGames)[number] & {
      score: number | null
      progress: { id: string; game_id: string; status: string; score: number | null; attempts: number }
    }
  >

  const dailyStarProgress = Math.min(totalStars, dailyStarGoal)

  return (
    <>
      <div className="space-y-12 bg-surface">
        {/* Hero Bento Section */}
        <motion.section
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 gap-5 md:grid-cols-3"
        >
          {/* Featured Game Banner */}
          <motion.div variants={fadeInUp} className="md:col-span-2">
            <Link
              href={featuredHref}
              className="group relative block h-64 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-soft-sm transition-shadow hover:shadow-soft md:h-80"
            >
              <div className="absolute inset-0 bg-primary-soft" />
              {featuredGame?.thumbnail_url && (
                <Image
                  src={featuredGame.thumbnail_url}
                  alt={featuredGame.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 66vw"
                  className="object-cover opacity-20"
                />
              )}
              <div className="absolute inset-0 flex flex-col justify-end p-6 text-on-surface md:p-8">
                <span className="mb-3 w-fit rounded-full bg-primary px-3 py-1 text-base font-bold uppercase tracking-wide text-on-primary">
                  {t('preschool.featured.badge')}
                </span>
                <h1 className="mb-2 font-headline text-3xl font-bold leading-tight text-on-surface md:text-5xl">
                  {featuredGame?.title ?? t('preschool.featured.fallbackTitle')}
                </h1>
                {featuredGame?.category && (
                  <p className="hidden max-w-md text-lg text-on-surface-variant md:block">
                    {getCategoryConfig(featuredGame.category).label}
                  </p>
                )}
                <motion.span
                  className="mt-4 inline-flex min-h-16 w-fit items-center gap-2 rounded-full bg-primary px-7 py-3 text-lg font-bold text-on-primary shadow-soft-sm transition-colors hover:bg-primary-dim"
                >
                  <Icon name="Play" weight="fill" />
                  {t('preschool.featured.playNow')}
                </motion.span>
              </div>
            </Link>
          </motion.div>

          {/* Daily Mission Card */}
          <motion.div
            variants={staggerItem}
            className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-soft-sm md:p-8"
          >
            <div className="z-10">
              <h3 className="font-headline text-2xl font-bold leading-tight text-on-surface">
                {t('preschool.dailyMission.title')}
              </h3>
              <p className="mt-2 text-lg text-on-surface-variant">
                {t('preschool.dailyMission.subtitle', { count: dailyStarGoal })}
              </p>
            </div>
            <div className="z-10 mt-5 flex flex-wrap items-end justify-between gap-3">
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="flex flex-wrap gap-1"
              >
                {Array.from({ length: dailyStarGoal }).map((_, i) => {
                  const isFilled = i < dailyStarProgress
                  return (
                    <motion.div
                      key={i}
                      variants={isFilled ? fadeInUp : staggerItem}
                      className={`flex h-9 w-9 items-center justify-center min-[360px]:h-10 min-[360px]:w-10 rounded-full border border-outline-variant ${
                        isFilled
                          ? 'bg-gold-soft'
                          : 'bg-surface-container'
                      }`}
                    >
                      <Icon
                        name="Star"
                        weight="fill"
                        size={18}
                        className={isFilled ? 'text-gold-deep' : 'text-outline'}
                      />
                    </motion.div>
                  )
                })}
              </motion.div>
              <span className="text-3xl font-bold text-on-surface">
                {dailyStarProgress}/{dailyStarGoal}
              </span>
            </div>
          </motion.div>
        </motion.section>

        {/* Jocuri Noi Section */}
        <section>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest text-primary shadow-soft-sm" aria-hidden="true">
                <Icon name="RocketLaunch" weight="fill" className="text-primary" />
              </div>
              <h2 className="font-headline text-xl font-bold text-on-surface min-[360px]:text-2xl md:text-3xl">{t('preschool.newGames.title')}</h2>
            </div>
            <Link
              href={ROUTES.STUDENT.ACTIVITIES}
              className="flex min-h-16 items-center rounded-full px-3 text-lg font-bold text-primary hover:bg-primary-soft"
            >
              {t('preschool.newGames.viewAll')}
            </Link>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5"
          >
            {newGames.map((game) => (
              <motion.div key={game.id} variants={staggerItem}>
                <Link href={ROUTES.PLAY.ACTIVITY(game.id)} className="block">
                  <motion.div
                    className="group flex min-h-16 cursor-pointer flex-col items-center rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-center shadow-soft-sm transition-shadow hover:shadow-soft"
                  >
                    <div className="relative mb-4 aspect-square w-full overflow-hidden rounded-xl bg-surface-container">
                      {game.thumbnail_url ? (
                        <Image
                          src={game.thumbnail_url}
                          alt={game.title}
                          fill
                          sizes="(max-width: 1024px) 50vw, 25vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon
                            name="GameController"
                            size={40}
                            className="text-on-surface-variant/40"
                          />
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-on-surface text-lg leading-tight line-clamp-2">
                      {game.title}
                    </h3>
                    {game.category && (
                      <span className="mt-1 text-lg text-on-surface-variant">
                        {getCategoryConfig(game.category).label}
                      </span>
                    )}
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <StudentActivitiesLane activities={activities} />

        {/* Favoritele Mele Section */}
        {favorites.length > 0 && (
          <section className="pb-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest text-primary shadow-soft-sm" aria-hidden="true">
                <Icon name="Heart" weight="fill" className="text-primary" />
              </div>
              <h2 className="font-headline text-2xl font-bold text-on-surface md:text-3xl">{t('preschool.favorites.title')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {favorites.map((game, index) => (
                <Link key={game.id} href={ROUTES.PLAY.ACTIVITY(game.id)} className="block">
                  <motion.div
                    className="flex min-h-16 items-center gap-5 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-soft-sm transition-shadow hover:shadow-soft"
                  >
                    <div
                      className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl ${
                        index === 0 ? 'bg-primary-soft' : 'bg-blue-wash'
                      }`}
                    >
                      <Icon
                        name={index === 0 ? 'PuzzlePiece' : 'Sparkle'}
                        weight="fill"
                        size={36}
                        className={index === 0 ? 'text-primary-deep' : 'text-blue-deep'}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-xl text-on-surface truncate">
                        {game.title}
                      </h3>
                      <p className="text-lg text-on-surface-variant mt-1">
                        {game.progress.attempts > 0
                          ? t('preschool.favorites.playedTimes', { count: game.progress.attempts })
                          : t('preschool.favorites.points', { count: game.score ?? 0 })}
                      </p>
                    </div>
                    <Icon
                      name="CaretRight"
                      size={24}
                      className={index === 0 ? 'text-primary shrink-0' : 'text-blue-deep shrink-0'}
                    />
                  </motion.div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Floating Action Button */}
      <motion.div
        className="fixed bottom-24 right-6 z-40 md:bottom-8"
      >
        <Link
          href={featuredHref}
          aria-label={t('preschool.fab.ariaLabel')}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-soft-sm transition-colors hover:bg-primary-dim focus-ring"
        >
          <Icon name="Play" weight="fill" className="text-on-primary" size={32} />
        </Link>
      </motion.div>
    </>
  )
}
