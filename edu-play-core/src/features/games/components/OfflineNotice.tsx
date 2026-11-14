'use client'

import { motion } from 'framer-motion'
import { Button, Card } from '@/shared/components/ui/kit'
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { fadeInUp, staggerContainer, staggerItem } from '@/config/animations'

type OfflineKind = 'offline' | 'load_error'

interface OfflineNoticeProps {
  kind: OfflineKind
  onRetry: () => void
  onBack: () => void
}

const COPY: Record<OfflineKind, { title: string; body: string; icon: IconName }> = {
  offline: {
    title: 'Călătoria așteaptă conexiunea',
    body: 'Conectează-te la internet și încearcă din nou. Totul va porni când ești online.',
    icon: 'WifiSlash',
  },
  load_error: {
    title: 'Jocul nu s-a putut încărca',
    body: 'Ceva nu a mers bine. Hai să mai încercăm o dată!',
    icon: 'WarningCircle',
  },
}

export function OfflineNotice({ kind, onRetry, onBack }: OfflineNoticeProps) {
  const copy = COPY[kind]
  return (
    <motion.div
      className="h-full w-full flex items-center justify-center px-6 py-8"
      style={{ background: 'var(--color-surface)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-[420px]"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <Card mode="kid" tone="cream" padding="lg" depth={6}>
          <div className="flex flex-col items-center text-center gap-4">
            <motion.div
              variants={fadeInUp}
              aria-hidden="true"
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: 'var(--color-blue)',
                border: '3px solid var(--color-blue-dim)',
                boxShadow: 'var(--shadow-soft-sm)',
              }}
            >
              <Icon name={copy.icon} size={32} />
            </motion.div>

            <motion.h2
              variants={staggerItem}
              className="font-headline text-2xl font-bold"
              style={{ color: 'var(--color-on-surface)' }}
            >
              {copy.title}
            </motion.h2>

            <motion.p
              variants={staggerItem}
              className="text-base max-w-[320px]"
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              {copy.body}
            </motion.p>

            <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-2.5 w-full mt-2">
              <Button
                mode="kid"
                tone="lime"
                size="lg"
                onClick={onRetry}
                className="flex-1"
                aria-label="Încearcă din nou"
              >
                <Icon name="ArrowClockwise" size={18} />
                Reîncearcă
              </Button>
              <Button
                mode="kid"
                tone="cream"
                size="lg"
                onClick={onBack}
                className="flex-1"
                aria-label="Înapoi la jocuri"
              >
                <Icon name="ArrowLeft" size={18} />
                Înapoi
              </Button>
            </motion.div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
