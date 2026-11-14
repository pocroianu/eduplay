'use client'

import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { fadeInUp, staggerContainer, staggerItem } from '@/config/animations'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { Button } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'

interface AudienceCardConfig {
  key: 'teachers' | 'students' | 'families' | 'admins'
  icon: IconName
  titleKey: string
  descriptionKey: string
  proofKey: string
  ctaKey?: string
  iconClassName: string
  href?: string
}

const audienceCards: AudienceCardConfig[] = [
  {
    key: 'teachers',
    icon: 'GraduationCap',
    titleKey: 'audienceSplit.cards.teachers.title',
    descriptionKey: 'audienceSplit.cards.teachers.description',
    proofKey: 'audienceSplit.cards.teachers.proof',
    ctaKey: 'audienceSplit.cards.cta',
    iconClassName: 'bg-primary text-on-primary',
    href: ROUTES.AUTH.REGISTER,
  },
  {
    key: 'students',
    icon: 'GameController',
    titleKey: 'audienceSplit.cards.students.title',
    descriptionKey: 'audienceSplit.cards.students.description',
    proofKey: 'audienceSplit.cards.students.proof',
    ctaKey: 'audienceSplit.cards.cta',
    iconClassName: 'bg-primary text-on-primary',
    href: ROUTES.AUTH.STUDENT_LOGIN,
  },
  {
    key: 'families',
    icon: 'Users',
    titleKey: 'audienceSplit.cards.families.title',
    descriptionKey: 'audienceSplit.cards.families.description',
    proofKey: 'audienceSplit.cards.families.proof',
    ctaKey: 'audienceSplit.cards.cta',
    iconClassName: 'bg-primary text-on-primary',
    href: ROUTES.AUTH.REGISTER,
  },
  {
    key: 'admins',
    icon: 'ChartBar',
    titleKey: 'audienceSplit.cards.admins.title',
    descriptionKey: 'audienceSplit.cards.admins.description',
    proofKey: 'audienceSplit.cards.admins.proof',
    iconClassName: 'bg-primary text-on-primary',
  },
]

export function AudienceSplit() {
  const { t } = useTranslation('landing')

  return (
    <section
      className="relative overflow-hidden bg-primary-wash"
      aria-labelledby="learning-loop-heading"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-80px' }}
          className="mx-auto mb-12 max-w-4xl text-center lg:mb-16"
        >
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 shadow-soft-sm"
          >
            <Icon name="Handshake" weight="fill" size="xs" className="text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface">
              {t('audienceSplit.badge')}
            </span>
          </div>
          <h2
            id="learning-loop-heading"
            className="font-headline text-[38px] font-bold leading-tight tracking-tight text-on-surface md:text-[54px]"
          >
            {t('audienceSplit.heading')}
          </h2>
          <p
            className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-on-surface-variant lg:text-lg"
          >
            {t('audienceSplit.summary')}
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4"
        >
          {audienceCards.map((card) => (
            <AudienceCard key={card.key} card={card} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function AudienceCard({ card }: { card: AudienceCardConfig }) {
  const { t } = useTranslation('landing')

  return (
    <motion.article
      variants={staggerItem}
      className="flex h-full flex-col rounded-xl bg-surface-container-lowest p-6 text-on-surface shadow-soft-sm"
      data-testid={`landing-audience-card-${card.key}`}
    >
      <div
        className={`mb-6 flex h-14 w-14 items-center justify-center rounded-xl ${card.iconClassName}`}
        aria-hidden="true"
      >
        <Icon name={card.icon} weight="fill" size={28} />
      </div>
      <h3 className="mb-3 font-headline text-xl font-bold leading-tight tracking-tight">
        {t(card.titleKey)}
      </h3>
      <p className="mb-5 text-sm leading-relaxed text-on-surface-variant">
        {t(card.descriptionKey)}
      </p>
      <div className="mt-auto space-y-5">
        <div
          className="rounded-xl bg-primary-wash px-4 py-3 text-sm font-semibold leading-snug text-on-surface"
        >
          {t(card.proofKey)}
        </div>
        {card.href && card.ctaKey ? (
          <Button variant="ghost" size="md" href={card.href} className="justify-start px-0 text-primary hover:bg-transparent">
            {t(card.ctaKey)}
            <Icon name="ArrowRight" size="sm" aria-hidden />
          </Button>
        ) : null}
      </div>
    </motion.article>
  )
}
