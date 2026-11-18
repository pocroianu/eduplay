'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Icon } from '@/shared/components/ui/Icon';
import { Card, DashboardShell } from '@/shared/components/ui/kit'
import { getCategoryConfig, type GameWithProgress } from '@/features/games'
import { STUDENT_NAV_ITEMS } from '@/features/student-dashboard/config'
import { formatAgeBand, type AgeBand } from '@/shared/lib/utils/age'
import { ROUTES } from '@/shared/lib/constants'
import {
  fadeInUp,
  staggerContainer,
  staggerItem,
} from '@/config/animations'

interface StudentProgressContentProps {
  profile: {
    full_name: string
    avatar_url?: string | null
  }
  ageBand?: AgeBand
  games: GameWithProgress[]
}

type StageStatus = 'completed' | 'in_progress' | 'not_started'

interface StageStyle {
  pillClass: string
  label: string
}

const STAGE_STYLES: Record<StageStatus, StageStyle> = {
  completed: {
    pillClass: 'bg-primary text-on-primary',
    label: 'Finalizat',
  },
  in_progress: {
    pillClass: 'bg-primary text-on-primary',
    label: 'În progres',
  },
  not_started: {
    pillClass: 'bg-surface-container text-on-surface-variant',
    label: 'Neînceput',
  },
}

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'Explorator'
}

function getActivityTimestamp(game: GameWithProgress): string | null {
  return game.progress?.last_played_at ?? game.progress?.completed_at ?? null
}

function resolveStageStatus(progressStatus: string | null | undefined): StageStatus {
  if (progressStatus === 'completed') return 'completed'
  if (progressStatus === 'in_progress') return 'in_progress'
  return 'not_started'
}

export function StudentProgressContent({ profile, ageBand, games }: StudentProgressContentProps) {
  const firstName = getFirstName(profile.full_name)
  const stageLabel = formatAgeBand(ageBand)

  const sortedGames = [...games].sort((left, right) => {
    const leftDifficulty = left.difficulty_level ?? 0
    const rightDifficulty = right.difficulty_level ?? 0
    if (leftDifficulty !== rightDifficulty) {
      return leftDifficulty - rightDifficulty
    }
    const leftTime = getActivityTimestamp(left)
    const rightTime = getActivityTimestamp(right)
    return (rightTime ? new Date(rightTime).getTime() : 0) - (leftTime ? new Date(leftTime).getTime() : 0)
  })

  const completedGames = sortedGames.filter((game) => game.progress?.status === 'completed')
  const inProgressGames = sortedGames.filter((game) => game.progress?.status === 'in_progress')
  const nextGame =
    sortedGames.find((game) => game.progress?.status === 'in_progress') ??
    sortedGames.find((game) => game.progress?.status !== 'completed') ??
    sortedGames[0] ??
    null

  const totalGames = sortedGames.length
  const progressPercent = totalGames > 0 ? Math.round((completedGames.length / totalGames) * 100) : 0
  const bestScore = completedGames.length > 0
    ? Math.max(...completedGames.map((game) => game.progress?.score ?? 0))
    : 0
  const bestCategory = completedGames[0]?.category ?? sortedGames[0]?.category ?? null
  const categoryLabel = bestCategory ? getCategoryConfig(bestCategory).label : 'Explorare'

  const stages = sortedGames.slice(0, ageBand === '3-6' ? 5 : 8)

  const isEmpty = totalGames === 0

  return (
    <DashboardShell
      variant="student"
      profile={{
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        subtitle: `Harta pentru ${stageLabel}`,
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
                  Harta învățării
                </p>
                <h1 className="mt-1 text-3xl font-semibold text-on-surface">
                  Urmărește traseul tău prin jocuri
                </h1>
                <p className="mt-2 max-w-3xl text-[18px] text-on-surface-variant">
                  Etapele tale apar în ordinea progresului. Finalizează jocurile și deschide noi provocări.
                </p>
              </div>
              <div className="rounded-md border border-outline-variant bg-surface-container px-4 py-3 text-[18px] font-semibold text-on-surface">
                {progressPercent}% finalizat
              </div>
            </div>
          </Card>
        </motion.section>

        <motion.section variants={staggerItem}>
          <Card shadow={false} className="grid grid-cols-1 divide-y divide-outline-variant border border-outline-variant p-0 md:grid-cols-4 md:divide-x md:divide-y-0">
            {([
              { icon: 'Star', label: 'Cel mai bun scor', value: `${bestScore}%` },
              { icon: 'Trophy', label: 'Jocuri terminate', value: `${completedGames.length}` },
              { icon: 'Fire', label: 'Ritmul tău', value: completedGames.length > 0 ? 'Activ' : 'Start' },
              { icon: 'MapPin', label: 'Domeniu puternic', value: categoryLabel },
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
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-primary">
                <Icon name="RocketLaunch" size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-base font-semibold text-on-surface-variant">
                  Următorul pas
                </p>
                <h2 className="mb-3 text-2xl font-semibold text-on-surface">
                  {nextGame ? nextGame.title : 'Alege un joc'}
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={nextGame ? ROUTES.PLAY.ACTIVITY(nextGame.id) : ROUTES.STUDENT.ACTIVITIES}
                    className="inline-flex min-h-16 items-center gap-2 rounded-lg bg-primary px-5 text-[18px] font-semibold text-on-primary hover:bg-primary-dim focus-ring"
                  >
                    <Icon name="PlayCircle" size={20} />
                    {nextGame?.progress?.status === 'completed' ? 'Vezi jocul' : 'Continuă'}
                  </Link>
                  <Link
                    href={ROUTES.STUDENT.REWARDS}
                    className="inline-flex min-h-16 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-5 text-[18px] font-semibold text-on-surface hover:bg-surface-container focus-ring"
                  >
                    <Icon name="Diamond" size={20} />
                    Stickere
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section variants={fadeInUp}>
          <Card shadow={false} className="border border-outline-variant p-0">
            <div className="flex flex-col gap-3 border-b border-outline-variant p-5 md:flex-row md:items-center md:justify-between md:p-6">
              <div>
                <h2 className="text-2xl font-semibold text-on-surface">Traseul tău</h2>
                <p className="text-[18px] text-on-surface-variant">
                  Fiecare etapă urmează ordinea progresului.
                </p>
              </div>
              <Link
                href={ROUTES.STUDENT.ACTIVITIES}
                className="inline-flex min-h-16 items-center gap-2 rounded-lg px-4 text-[18px] font-semibold text-primary hover:bg-surface-container focus-ring"
              >
                Mai multe jocuri
                <Icon name="ArrowRight" size={18} />
              </Link>
            </div>

            {isEmpty ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-primary" aria-hidden="true">
                  <Icon name="MapPin" size={22} />
                </span>
                <p className="max-w-md text-[18px] text-on-surface-variant">
                  Harta ta se deschide după primul joc.
                </p>
                <Link
                  href={ROUTES.STUDENT.ACTIVITIES}
                  className="inline-flex min-h-16 items-center gap-2 rounded-lg bg-primary px-5 text-[18px] font-semibold text-on-primary hover:bg-primary-dim focus-ring"
                >
                  <Icon name="GameController" size={20} />
                  Alege un joc
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant">
                {stages.map((game, index) => {
                  const category = getCategoryConfig(game.category)
                  const status = resolveStageStatus(game.progress?.status)
                  const stageStyle = STAGE_STYLES[status]
                  const score = game.progress?.score ?? 0

                  return (
                    <article
                      key={game.id}
                      aria-label={`Etapa ${index + 1} · ${category.label} · ${stageStyle.label} · ${score}% finalizat`}
                      className="p-4 md:p-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container" aria-hidden="true">
                            <Icon name={category.icon} size={24} weight="fill" style={{ color: category.color }} aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-surface-container px-2 py-1 text-base font-semibold text-on-surface-variant">
                                Etapa {index + 1}
                              </span>
                              <span className={`rounded-md px-2 py-1 text-base font-semibold ${stageStyle.pillClass}`}>
                                {stageStyle.label}
                              </span>
                            </div>
                            <h3 className="mt-2 truncate text-[18px] font-semibold text-on-surface">{game.title}</h3>
                            <p className="text-base text-on-surface-variant">
                              {category.label} · nivel {game.difficulty_level ?? 1}
                            </p>
                          </div>
                        </div>
                        <div className="flex min-w-[180px] flex-col gap-2">
                          <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-base text-on-surface-variant">Scor: {score}%</span>
                            <Link
                              href={ROUTES.PLAY.ACTIVITY(game.id)}
                              className="inline-flex min-h-16 items-center gap-2 rounded-lg bg-primary px-4 text-[18px] font-semibold text-on-primary hover:bg-primary-dim focus-ring"
                            >
                              {status === 'completed' ? 'Revino' : 'Joacă'}
                              <Icon name="ArrowRight" size={18} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </Card>
        </motion.section>

        {!isEmpty && (
          <motion.section
            variants={staggerItem}
            className="grid grid-cols-1 gap-4 xl:grid-cols-2"
          >
            <Link
              href={ROUTES.STUDENT.REWARDS}
              className="block rounded-lg border border-outline-variant bg-surface-container-lowest p-5 hover:bg-surface-container focus-ring"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="mb-3 inline-block rounded-md bg-gold-container px-3 py-1 text-base font-semibold text-on-secondary-container">
                    Stickere
                  </span>
                  <h3 className="mb-2 text-lg font-semibold text-on-surface">
                    Deschide colecția ta
                  </h3>
                  <p className="max-w-[460px] text-lg text-on-surface-variant">
                    Fiecare etapă finalizată deblochează un sticker nou și o mică surpriză.
                  </p>
                </div>
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-primary"
                  aria-hidden="true"
                >
                  <Icon name="Diamond" size={22} />
                </div>
              </div>
            </Link>

            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="mb-3 inline-block rounded-md bg-primary px-3 py-1 text-base font-semibold text-on-primary">
                    Rezumat
                  </span>
                  <h3 className="mb-2 text-lg font-semibold text-on-surface">
                    {completedGames.length} terminate · {inProgressGames.length} în progres
                  </h3>
                  <p className="max-w-[460px] text-lg text-on-surface-variant">
                    {firstName}, deschide jocul următor și continuă călătoria pe hartă.
                  </p>
                </div>
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-primary"
                  aria-hidden="true"
                >
                  <Icon name="Trophy" size={22} />
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </motion.div>
    </DashboardShell>
  )
}
