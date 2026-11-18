'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Icon } from '@/shared/components/ui/Icon';
import { Card, DashboardShell } from '@/shared/components/ui/kit'
import { getCategoryConfig, type GameCategory, type GameWithProgress } from '@/features/games'
import { STUDENT_NAV_ITEMS } from '@/features/student-dashboard/config'
import { formatAgeBand, type AgeBand } from '@/shared/lib/utils/age'
import { ROUTES } from '@/shared/lib/constants'
import {
  fadeInUp,
  staggerContainer,
  staggerItem,
} from '@/config/animations'

interface StudentRewardsContentProps {
  profile: {
    full_name: string
    avatar_url?: string | null
  }
  ageBand?: AgeBand
  games: GameWithProgress[]
}

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'Explorator'
}

function getActivityTimestamp(game: GameWithProgress): string | null {
  return game.progress?.last_played_at ?? game.progress?.completed_at ?? null
}

function formatStreak(games: GameWithProgress[]): number {
  const activeDays = new Set<string>()
  for (const game of games) {
    const timestamp = getActivityTimestamp(game)
    if (!timestamp) continue
    const date = new Date(timestamp)
    activeDays.add(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    )
  }

  if (activeDays.size === 0) return 0

  const orderedDays = Array.from(activeDays).sort().reverse()
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const yesterday = new Date(today.getTime() - 86_400_000)
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  if (orderedDays[0] !== todayKey && orderedDays[0] !== yesterdayKey) {
    return 0
  }

  let streak = 0
  let cursor = new Date(`${orderedDays[0]}T00:00:00`)
  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    if (!activeDays.has(key)) break
    streak += 1
    cursor = new Date(cursor.getTime() - 86_400_000)
  }

  return streak
}

export function StudentRewardsContent({ profile, ageBand, games }: StudentRewardsContentProps) {
  const firstName = getFirstName(profile.full_name)
  const stageLabel = formatAgeBand(ageBand)

  const sortedGames = [...games].sort((left, right) => {
    const leftTime = getActivityTimestamp(left)
    const rightTime = getActivityTimestamp(right)
    return (rightTime ? new Date(rightTime).getTime() : 0) - (leftTime ? new Date(leftTime).getTime() : 0)
  })

  const completedGames = sortedGames.filter((game) => game.progress?.status === 'completed')
  const totalStars = completedGames.reduce((sum, game) => {
    const score = game.progress?.score ?? 0
    if (score >= 90) return sum + 3
    if (score >= 70) return sum + 2
    if (score >= 50) return sum + 1
    return sum
  }, 0)

  const streak = formatStreak(sortedGames)
  const featuredGame = completedGames[0] ?? sortedGames[0] ?? null
  const completionPercent = sortedGames.length > 0 ? Math.round((completedGames.length / sortedGames.length) * 100) : 0
  const unlockedCategories = Array.from(
    new Set(
      completedGames
        .map((game) => game.category)
        .filter((category): category is GameCategory => Boolean(category)),
    ),
  )

  const stickerCards = completedGames.slice(0, ageBand === '3-6' ? 6 : 8).map((game, index) => {
    const category = getCategoryConfig(game.category)
    const score = game.progress?.score ?? 0
    const stars = score >= 90 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0
    return {
      id: game.id,
      title: game.title,
      category,
      score,
      stars,
      icon: category.icon,
      isNewlyUnlocked: index === 0,
    }
  })

  const shellSlots = Array.from({ length: ageBand === '3-6' ? 8 : 12 }).map((_, index) => {
    const card = stickerCards[index]
    return card
      ? { kind: 'unlocked' as const, ...card }
      : { kind: 'locked' as const, index }
  })

  return (
    <DashboardShell
      variant="student"
      profile={{
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        subtitle: `Colecția ta ${stageLabel}`,
      }}
      navItems={STUDENT_NAV_ITEMS}
      levelLabel={stageLabel}
      topBar={{ showLogo: true }}
      contentClassName="max-w-6xl"
    >
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="flex flex-col gap-6"
      >
        <motion.section variants={fadeInUp}>
          <Card shadow={false} className="border border-outline-variant p-0">
            <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
              <div>
                <p className="text-base font-semibold uppercase tracking-wide text-on-surface-variant">
                  Premiile mele
                </p>
                <h1 className="mt-1 text-3xl font-semibold text-on-surface">
                  Colecționează stickere și deblochează surprize
                </h1>
                <p className="mt-2 max-w-3xl text-[18px] text-on-surface-variant">
                  Fiecare joc finalizat adaugă un sticker în albumul tău.
                </p>
              </div>
              <div className="rounded-md border border-outline-variant bg-surface-container px-4 py-3 text-[18px] font-semibold text-on-surface">
                {completedGames.length} stickere
              </div>
            </div>
          </Card>
        </motion.section>

        <motion.section variants={staggerItem}>
          <Card shadow={false} className="grid grid-cols-1 divide-y divide-outline-variant border border-outline-variant p-0 md:grid-cols-4 md:divide-x md:divide-y-0">
            {([
              { icon: 'Diamond', label: 'Stickere', value: `${completedGames.length}` },
              { icon: 'Star', label: 'Stele', value: `${totalStars}` },
              { icon: 'Sparkle', label: 'Categorii', value: `${unlockedCategories.length}` },
              { icon: 'Fire', label: 'Seria', value: `${streak}` },
            ] as const).map((stat) => (
              <div key={stat.label} className="flex min-h-16 items-center gap-3 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-primary" aria-hidden="true">
                  <Icon name={stat.icon} size={22} />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-medium text-on-surface-variant">{stat.label}</p>
                  <p className="truncate text-2xl font-semibold text-on-surface">{stat.value}</p>
                </div>
              </div>
            ))}
          </Card>
        </motion.section>

        <motion.section variants={fadeInUp}>
          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5 md:p-6">
            <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
              <div>
                <h2 className="text-2xl font-semibold text-on-surface">Albumul de stickere</h2>
                <p className="text-on-surface-variant text-lg">
                  Stickerele deblocate apar primele. Restul rămân ascunse până la următorul progres.
                </p>
              </div>
              <Link
                href={ROUTES.STUDENT.ACTIVITIES}
                className="inline-flex min-h-16 items-center gap-2 rounded-lg px-4 text-[18px] font-semibold text-primary hover:bg-surface-container focus-ring"
              >
                Joacă din nou
                <Icon name="RocketLaunch" size={18} />
              </Link>
            </div>

            <div
              className={`grid gap-4 ${
                ageBand === '3-6'
                  ? 'grid-cols-2 md:grid-cols-3'
                  : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
              }`}
            >
              {shellSlots.map((slot, index) =>
                slot.kind === 'unlocked' ? (
                  <motion.article
                    key={slot.id}
                    variants={staggerItem}
                    aria-label={`Sticker deblocat · ${slot.category.label} · ${slot.title} · ${slot.score}% · ${slot.stars} ${
                      slot.stars === 1 ? 'stea' : 'stele'
                    }`}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest"
                  >
                    <div className="p-5 text-center">
                      <div
                        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-outline-variant bg-surface-container"
                        aria-hidden="true"
                      >
                        <Icon name={slot.icon} size={32} weight="fill" style={{ color: slot.category.color }} aria-hidden />
                      </div>
                      <span className="mb-3 inline-block rounded-md bg-primary px-3 py-1 text-base font-semibold text-on-primary">
                        {slot.isNewlyUnlocked ? 'Sticker nou' : 'Sticker'}
                      </span>
                      <p className="text-lg font-semibold text-on-surface line-clamp-2">{slot.title}</p>
                      <p className="text-base text-on-surface-variant mt-2">{slot.category.label}</p>
                      <div className="flex justify-center gap-1 mt-4" aria-hidden="true">
                        {Array.from({ length: slot.stars }).map((_, starIndex) => (
                          <Icon
                            key={`${slot.id}-${starIndex}`}
                            name="Star"
                            weight="fill"
                            size={16}
                            className="text-gold-container"
                          />
                        ))}
                      </div>
                      <p className="text-base text-on-surface-variant mt-3">Scor: {slot.score}%</p>
                    </div>
                  </motion.article>
                ) : (
                  <article
                    key={`locked-${index}`}
                    aria-label="Sticker încă neobținut. Joacă pentru a-l debloca."
                    className="rounded-lg border border-dashed border-outline-variant bg-surface-container"
                  >
                    <div className="p-5 text-center">
                      <div
                        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-outline-variant bg-surface-container"
                        aria-hidden="true"
                      >
                        <Icon name="Diamond" size={32} className="text-outline-variant" />
                      </div>
                      <span className="mb-3 inline-block rounded-md bg-surface-container px-3 py-1 text-base font-semibold text-on-surface-variant">
                        Curând
                      </span>
                      <p className="text-lg font-semibold text-on-surface">Următorul sticker</p>
                      <p className="text-base text-on-surface-variant mt-2">
                        Joacă pentru a le debloca.
                      </p>
                    </div>
                  </article>
                ),
              )}
            </div>
          </div>
        </motion.section>

        <motion.section
          variants={staggerItem}
          className="grid grid-cols-1 xl:grid-cols-2 gap-4"
        >
          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
            <span className="mb-3 inline-block rounded-md bg-gold-container px-3 py-1 text-base font-semibold text-on-secondary-container">
              Recomandare
            </span>
            <h3 className="text-lg font-semibold text-on-surface mb-2">
              {featuredGame?.title ?? 'Alege un joc pentru a câștiga primul sticker'}
            </h3>
            <p className="text-lg text-on-surface-variant mb-4">
              Stickerele apar după fiecare progres finalizat. Următorul joc bun îți poate aduce o nouă colecție.
            </p>
            <Link
              href={ROUTES.STUDENT.PROGRESS}
              className="inline-flex min-h-16 items-center gap-2 rounded-lg bg-primary px-5 text-[18px] font-semibold text-on-primary hover:bg-primary-dim focus-ring"
            >
              <Icon name="MapPin" size={20} />
              Vezi harta
            </Link>
          </div>

          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
            <span className="mb-3 inline-block rounded-md bg-primary px-3 py-1 text-base font-semibold text-on-primary">
              Rezumat rapid
            </span>
            <h3 className="text-lg font-semibold text-on-surface mb-2">
              {completedGames.length} jocuri terminate
            </h3>
            <p className="text-lg text-on-surface-variant mb-4">
              {firstName}, ai deja {totalStars} {totalStars === 1 ? 'stea' : 'stele'} și {unlockedCategories.length}{' '}
              {unlockedCategories.length === 1 ? 'domeniu activ' : 'domenii active'} în colecția ta.
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${completionPercent}%` }}
                aria-hidden="true"
              />
            </div>
            <p className="text-lg text-on-surface-variant mt-2">
              {completionPercent}% din colecția disponibilă
            </p>
          </div>
        </motion.section>
      </motion.div>
    </DashboardShell>
  )
}
