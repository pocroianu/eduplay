'use client'

import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { fadeInUp, staggerContainer, staggerItem } from '@/config/animations'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { Button } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'

interface EvidenceCard {
  titleKey: string
  descriptionKey: string
  icon: IconName
  accent: string
}

const guideCards: EvidenceCard[] = [
  {
    titleKey: 'trust.guides.teacher.title',
    descriptionKey: 'trust.guides.teacher.description',
    icon: 'BookOpen',
    accent: 'var(--color-primary)',
  },
  {
    titleKey: 'trust.guides.research.title',
    descriptionKey: 'trust.guides.research.description',
    icon: 'Brain',
    accent: 'var(--color-blue)',
  },
  {
    titleKey: 'trust.guides.progress.title',
    descriptionKey: 'trust.guides.progress.description',
    icon: 'ChartLineUp',
    accent: 'var(--color-gold)',
  },
]

const proofCards: EvidenceCard[] = [
  {
    titleKey: 'trust.proof.privacy.title',
    descriptionKey: 'trust.proof.privacy.description',
    icon: 'ShieldCheck',
    accent: 'var(--color-primary)',
  },
  {
    titleKey: 'trust.proof.romanian.title',
    descriptionKey: 'trust.proof.romanian.description',
    icon: 'TextAa',
    accent: 'var(--color-blue)',
  },
]

export function TrustSection() {
  const { t } = useTranslation('landing')

  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: 'var(--color-surface-container-lowest)' }}
      aria-labelledby="evidence-heading"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-80px' }}
          className="mb-10 max-w-4xl lg:mb-14"
        >
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2"
            style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-soft-sm)' }}
          >
            <Icon name="Medal" weight="fill" size="xs" style={{ color: 'var(--color-primary)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface">
              {t('trust.evidenceBadge')}
            </span>
          </div>
          <h2
            id="evidence-heading"
            className="font-headline text-[36px] font-bold leading-tight tracking-tight text-on-surface md:text-[50px]"
          >
            {t('trust.evidenceTitle')}
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-relaxed lg:text-lg" style={{ color: 'var(--color-on-surface-variant)' }}>
            {t('trust.evidenceDescription')}
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 gap-5 lg:grid-cols-3"
        >
          {guideCards.map((card) => (
            <EvidenceTile key={card.titleKey} card={card} />
          ))}
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-80px' }}
          className="mt-8 grid grid-cols-1 overflow-hidden rounded-2xl border border-outline-variant bg-surface text-on-surface lg:grid-cols-12"
          style={{ boxShadow: 'var(--shadow-soft)' }}
        >
          <div className="p-6 lg:col-span-7 lg:p-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
              {t('trust.band.eyebrow')}
            </p>
            <h3 className="font-headline text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
              {t('trust.band.title')}
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              {t('trust.band.description')}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button variant="primary" size="md" href={ROUTES.AUTH.REGISTER}>
                {t('trust.band.primaryCta')}
                <Icon name="ArrowRight" size="sm" aria-hidden />
              </Button>
              <Button variant="secondary" size="md" href={ROUTES.AUTH.LOGIN}>
                {t('trust.band.secondaryCta')}
              </Button>
            </div>
          </div>
          <div className="grid gap-4 border-t border-outline-variant bg-surface-container-lowest p-6 lg:col-span-5 lg:border-l lg:border-t-0 lg:p-8">
            {proofCards.map((card) => (
              <EvidenceTile key={card.titleKey} card={card} compact />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function EvidenceTile({ card, compact = false }: { card: EvidenceCard; compact?: boolean }) {
  const { t } = useTranslation('landing')

  return (
    <motion.article
      variants={staggerItem}
      className="rounded-2xl border border-outline-variant bg-surface p-6 text-on-surface"
      style={{ boxShadow: compact ? 'var(--shadow-soft-sm)' : 'var(--shadow-soft)' }}
    >
      <div
        className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: card.accent, color: 'var(--color-surface)' }}
        aria-hidden="true"
      >
        <Icon name={card.icon} weight="fill" size={26} />
      </div>
      <h3 className="mb-2 font-headline text-xl font-bold leading-tight tracking-tight">
        {t(card.titleKey)}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
        {t(card.descriptionKey)}
      </p>
    </motion.article>
  )
}
