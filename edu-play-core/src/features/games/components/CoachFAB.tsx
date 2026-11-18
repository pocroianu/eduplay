'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/Icon';
import { float } from '@/config/animations'
import { GameChromeButton } from './GameChromeButton'

interface CoachFABProps {
  onClick: () => void
}

export function CoachFAB({ onClick }: CoachFABProps) {
  const { t } = useTranslation('player')
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className="absolute bottom-3 right-3 z-20"
      variants={float}
      initial="initial"
      animate={reduceMotion ? undefined : 'animate'}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { y: 2 }}
    >
      <GameChromeButton
        onClick={onClick}
        aria-label={t('coach.open')}
        className="flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-primary shadow-soft-sm transition-colors hover:bg-primary-soft focus-ring"
      >
        <Icon name="MagicWand" size={26} />
      </GameChromeButton>
    </motion.div>
  )
}
