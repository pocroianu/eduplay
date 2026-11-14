'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/Icon';
import type { CategoryTheme } from './getCategoryTheme'
import { GameChromeButton } from './GameChromeButton'

interface ActionStripBaseProps {
  theme: CategoryTheme
  backUrl: string
  onBack?: () => void
}

interface ActionStripPlayProps extends ActionStripBaseProps {
  mode: 'play'
  pointTotal: number
  totalDots: number
  filledDots: number
  nextHref: string
}

interface ActionStripCompleteProps extends ActionStripBaseProps {
  mode: 'complete'
  onRetry: () => void
  nextHref: string
}

export type ActionStripProps = ActionStripPlayProps | ActionStripCompleteProps

function BackTile({
  backUrl,
  onBack,
  pressMotion,
}: {
  backUrl: string
  onBack?: () => void
  pressMotion?: { y: number }
}) {
  const { t } = useTranslation('player')
  const backLabel = t('actions.backToGames')
  const inner = (
    <span
      className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-lowest"
      style={{ boxShadow: 'var(--shadow-soft-sm)' }}
    >
      <Icon name="ArrowLeft" size={18} />
    </span>
  )
  return (
    <motion.div whileTap={pressMotion}>
      {onBack ? (
        <GameChromeButton
          onClick={onBack}
          className="w-16 h-16 -m-3 flex items-center justify-center rounded-2xl shrink-0"
          aria-label={backLabel}
        >
          {inner}
        </GameChromeButton>
      ) : (
        <Link
          href={backUrl}
          className="w-16 h-16 -m-3 flex items-center justify-center rounded-2xl shrink-0"
          aria-label={backLabel}
        >
          {inner}
        </Link>
      )}
    </motion.div>
  )
}

export function ActionStrip(props: ActionStripProps) {
  const { t } = useTranslation('player')
  const { theme, backUrl, onBack } = props
  const reduceMotion = useReducedMotion()
  const pressMotion = reduceMotion ? undefined : { y: 1 }
  const hoverMotion = reduceMotion ? undefined : { y: -1 }

  return (
    <motion.div
      layout
      className="mx-3 mb-3 flex min-h-16 shrink-0 items-center gap-2.5 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-2"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      <BackTile backUrl={backUrl} onBack={onBack} pressMotion={pressMotion} />

      {props.mode === 'play' ? (
        <>
          <div className="flex-1 flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <Icon name="Trophy" size={16} style={{ color: theme.accentColor }} />
              <span className="font-headline text-sm font-bold text-on-surface">
                {props.pointTotal}
              </span>
            </div>
            <div
              role="img"
              className="flex gap-1"
              aria-label={t('progress.label', { filled: props.filledDots, total: props.totalDots })}
            >
              {Array.from({ length: props.totalDots }).map((_, i) => (
                <span
                  key={i}
                  className="w-5 h-1 rounded-full"
                  style={{
                    background: i < props.filledDots ? theme.accentColor : 'var(--color-outline-variant)',
                  }}
                />
              ))}
            </div>
          </div>

          <motion.div className="shrink-0" whileHover={hoverMotion} whileTap={pressMotion}>
            <Link
              href={props.nextHref}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-headline text-sm font-bold text-on-primary"
              style={{
                background: theme.accentColor,
                boxShadow: 'var(--shadow-soft-sm)',
                minHeight: '64px',
              }}
            >
              {t('actions.next')}
              <Icon name="ArrowRight" size={18} />
            </Link>
          </motion.div>
        </>
      ) : (
        <>
          <motion.div className="flex-1" whileTap={pressMotion}>
            <GameChromeButton
            type="button"
            onClick={props.onRetry}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-surface-container-lowest px-4 py-2.5 font-headline text-sm font-bold text-on-surface-variant"
            style={{ boxShadow: 'var(--shadow-soft-sm)', minHeight: '64px' }}
            aria-label={t('actions.playAgain')}
          >
            <Icon name="ArrowCounterClockwise" size={18} />
            {t('actions.playAgainShort')}
            </GameChromeButton>
          </motion.div>

          <motion.div whileHover={hoverMotion} whileTap={pressMotion} className="flex-1">
            <Link
              href={props.nextHref}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 font-headline text-sm font-bold text-gold-deep"
              style={{
                background: 'var(--color-gold)',
                boxShadow: 'var(--shadow-soft-sm)',
                minHeight: '64px',
              }}
            >
              {t('actions.next')}
              <Icon name="ArrowRight" size={18} />
            </Link>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
