'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Button, Card, Pill } from '@/shared/components/ui/kit'
import { Icon } from '@/shared/components/ui/Icon'
import { fadeInUp, staggerContainer, staggerItem } from '@/config/animations'
import type { CategoryTheme } from './getCategoryTheme'
import { reducedFade, reducedStagger, reducedStaggerItem } from './reduced-motion'

interface PreGameCoverProps {
  theme: CategoryTheme
  title: string
  difficulty: number | null
  estimatedMinutes: number | null
  onStart: () => void
  onBack: () => void
}

function difficultyLabel(level: number | null): string {
  if (level === null) return 'Relaxat'
  if (level <= 1) return 'Ușor'
  if (level <= 3) return 'Mediu'
  return 'Provocator'
}

function difficultyStarCount(level: number | null): number {
  return level === null ? 1 : Math.max(1, Math.min(3, Math.round((level / 5) * 3)))
}

export function PreGameCover({
  theme,
  title,
  difficulty,
  estimatedMinutes,
  onStart,
  onBack,
}: PreGameCoverProps) {
  const reduceMotion = useReducedMotion()
  const fadeVariants = reduceMotion ? reducedFade : fadeInUp
  const staggerVariants = reduceMotion ? reducedStagger : staggerContainer
  const itemVariants = reduceMotion ? reducedStaggerItem : staggerItem

  return (
    <motion.section
      aria-labelledby="pre-game-title"
      className="absolute inset-0 z-20 flex items-center justify-center bg-surface px-4 py-6"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <motion.div
        className="w-full max-w-[560px]"
        variants={staggerVariants}
        initial="initial"
        animate="animate"
      >
        <Card mode="standard" tone="cream" padding="lg" shadow className="overflow-hidden">
          <motion.div
            className="flex flex-col items-center gap-5 text-center"
            variants={staggerVariants}
          >
            <motion.div
              variants={itemVariants}
              className="flex h-20 w-20 items-center justify-center rounded-2xl border border-outline-variant bg-primary-soft text-primary-deep shadow-soft-sm"
              aria-hidden="true"
            >
              <Icon name={theme.icon} size={42} weight="fill" aria-hidden />
            </motion.div>

            <motion.div variants={itemVariants} className="flex flex-col items-center gap-2">
              <span className="text-lg font-bold text-primary-deep">
                Gata de joc?
              </span>
              <h1
                id="pre-game-title"
                className="font-headline text-3xl font-bold leading-tight text-on-surface md:text-4xl"
              >
                {title}
              </h1>
            </motion.div>

            <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-2">
              <Pill mode="standard" tone="purple">
                <Icon name="Flag" size={14} aria-hidden />
                {theme.badge}
              </Pill>
              {estimatedMinutes !== null && estimatedMinutes > 0 && (
                <Pill mode="standard" tone="neutral">
                  <Icon name="Clock" size={14} aria-hidden />
                  ~{estimatedMinutes} min
                </Pill>
              )}
              <Pill mode="standard" tone="sun" aria-label={`Dificultate ${difficultyLabel(difficulty)}`}>
                <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                  {Array.from({ length: 3 }, (_, index) => (
                    <Icon
                      key={index}
                      name="Star"
                      weight={index < difficultyStarCount(difficulty) ? 'fill' : 'regular'}
                      size={14}
                    />
                  ))}
                </span>
                {difficultyLabel(difficulty)}
              </Pill>
            </motion.div>

            <motion.p
              variants={itemVariants}
              className="max-w-[380px] text-lg leading-relaxed text-on-surface-variant"
            >
              Apasă când ești gata. Îți dorim o aventură plină de descoperiri!
            </motion.p>

            <motion.div variants={itemVariants} className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button
                mode="kid"
                variant="primary"
                size="lg"
                tone="lime"
                onClick={onStart}
                aria-label="Să începem jocul"
                fullWidth
              >
                <Icon name="Play" size={20} aria-hidden />
                Să începem!
              </Button>
              <Button
                mode="kid"
                variant="ghost"
                size="lg"
                tone="cream"
                onClick={onBack}
                fullWidth
              >
                <Icon name="ArrowLeft" size={20} aria-hidden />
                Mai târziu
              </Button>
            </motion.div>
          </motion.div>
        </Card>
      </motion.div>
    </motion.section>
  )
}
