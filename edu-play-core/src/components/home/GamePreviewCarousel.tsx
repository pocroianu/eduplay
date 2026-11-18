'use client'

import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { fadeInUp, staggerContainer, staggerItem } from '@/config/animations'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { Button } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'

interface ChoicePoint {
  labelKey: string
  descriptionKey: string
  icon: IconName
}

const challenges: ChoicePoint[] = [
  {
    labelKey: 'whyChoose.challengeLabel',
    descriptionKey: 'whyChoose.challenges.fragmented.description',
    icon: 'WarningCircle',
  },
  {
    labelKey: 'whyChoose.challengeLabel',
    descriptionKey: 'whyChoose.challenges.progress.description',
    icon: 'Hourglass',
  },
  {
    labelKey: 'whyChoose.challengeLabel',
    descriptionKey: 'whyChoose.challenges.context.description',
    icon: 'Question',
  },
]

const benefits: ChoicePoint[] = [
  {
    labelKey: 'whyChoose.benefitLabel',
    descriptionKey: 'whyChoose.benefits.unified.description',
    icon: 'SquaresFour',
  },
  {
    labelKey: 'whyChoose.benefitLabel',
    descriptionKey: 'whyChoose.benefits.progress.description',
    icon: 'ChartLineUp',
  },
  {
    labelKey: 'whyChoose.benefitLabel',
    descriptionKey: 'whyChoose.benefits.safe.description',
    icon: 'ShieldCheck',
  },
]

const previewRows = [
  { titleKey: 'whyChoose.preview.rows.class.title', valueKey: 'whyChoose.preview.rows.class.value', tone: 'var(--color-primary)' },
  { titleKey: 'whyChoose.preview.rows.activities.title', valueKey: 'whyChoose.preview.rows.activities.value', tone: 'var(--color-blue)' },
  { titleKey: 'whyChoose.preview.rows.progress.title', valueKey: 'whyChoose.preview.rows.progress.value', tone: 'var(--color-gold)' },
] as const

export function GamePreviewCarousel() {
  const { t } = useTranslation('landing')

  return (
    <section
      className="relative overflow-hidden py-16 lg:py-24"
      style={{ backgroundColor: 'var(--color-surface)' }}
      aria-labelledby="why-choose-heading"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-80px' }}
          className="mb-12 grid grid-cols-1 items-end gap-6 lg:mb-16 lg:grid-cols-12"
        >
          <div className="lg:col-span-7">
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2"
              style={{ backgroundColor: 'var(--color-surface-container-lowest)', boxShadow: 'var(--shadow-soft-sm)' }}
            >
              <Icon name="Lightbulb" size="xs" weight="fill" style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface">
                {t('whyChoose.badge')}
              </span>
            </div>
            <h2
              id="why-choose-heading"
              className="font-headline text-[38px] font-bold leading-tight tracking-tight text-on-surface md:text-[54px]"
            >
              {t('whyChoose.title')}
            </h2>
          </div>
          <p
            className="text-base leading-relaxed lg:col-span-5 lg:text-lg"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            {t('whyChoose.description')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-7"
          >
            <div className="space-y-4">
              {challenges.map((point) => (
                <ChoicePill key={point.descriptionKey} point={point} tone="var(--color-primary)" />
              ))}
            </div>
            <div className="space-y-4">
              {benefits.map((point) => (
                <ChoicePill key={point.descriptionKey} point={point} tone="var(--color-blue)" />
              ))}
            </div>
          </motion.div>

          <motion.aside
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-80px' }}
            className="relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-on-surface lg:col-span-5 lg:p-8"
            style={{ boxShadow: 'var(--shadow-soft)' }}
            aria-label={t('whyChoose.preview.ariaLabel')}
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                  {t('whyChoose.preview.eyebrow')}
                </p>
                <h3 className="mt-1 font-headline text-2xl font-bold tracking-tight">{t('whyChoose.preview.title')}</h3>
              </div>
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
                aria-hidden="true"
              >
                <Icon name="ChartBar" weight="fill" size={26} />
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-outline bg-surface p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-sm font-bold">{t('whyChoose.preview.weeklyActivity')}</span>
                <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant">{t('whyChoose.preview.live')}</span>
              </div>
              <div className="space-y-3">
                {previewRows.map((row) => (
                  <div key={row.titleKey} className="flex items-center gap-3 rounded-lg border border-outline-variant p-3">
                    <span className="h-10 w-2 rounded-full" style={{ backgroundColor: row.tone }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm font-semibold">{t(row.titleKey)}</span>
                    <span className="text-sm font-bold" style={{ color: row.tone }}>{t(row.valueKey)}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-3 text-xs font-medium text-on-surface-variant">{t('whyChoose.preview.illustrationNote')}</p>

            <div className="mt-6 rounded-xl border border-outline-variant bg-surface p-4">
              <p className="text-sm font-semibold leading-relaxed">
                {t('whyChoose.preview.note')}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button variant="primary" size="md" href={ROUTES.AUTH.REGISTER}>
                {t('whyChoose.preview.primaryCta')}
                <Icon name="ArrowRight" size="sm" aria-hidden />
              </Button>
              <Button variant="secondary" size="md" href={ROUTES.AUTH.LOGIN}>
                {t('whyChoose.preview.secondaryCta')}
              </Button>
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  )
}

function ChoicePill({ point, tone }: { point: ChoicePoint; tone: string }) {
  const { t } = useTranslation('landing')

  return (
    <motion.article
      variants={staggerItem}
      className="rounded-2xl border border-outline-variant bg-surface p-5 text-on-surface"
      style={{ boxShadow: 'var(--shadow-soft-sm)' }}
    >
      <div className="mb-3 flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: tone, color: 'var(--color-surface)' }}
          aria-hidden="true"
        >
          <Icon name={point.icon} weight="fill" size={22} />
        </span>
        <span className="rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-bold uppercase tracking-wider">
          {t(point.labelKey)}
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
        {t(point.descriptionKey)}
      </p>
    </motion.article>
  )
}
