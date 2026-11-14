'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { fadeInUp, staggerContainer, staggerItem } from '@/config/animations'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { Button } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'

const navLinks = [
  'hero.nav.products',
  'hero.nav.teachers',
  'hero.nav.families',
  'hero.nav.schools',
] as const

const collageCards = [
  {
    icon: 'GameController' as IconName,
    titleKey: 'hero.visual.gameLabel',
    bodyKey: 'hero.visual.gameSublabel',
    className: 'left-0 top-12 w-64 bg-surface-container-lowest text-on-surface',
    iconClassName: 'bg-primary text-on-primary',
  },
  {
    icon: 'Users' as IconName,
    titleKey: 'hero.trustPills.gdpr',
    bodyKey: 'hero.descriptionStrong',
    className: 'right-0 top-0 w-56 bg-surface-container-lowest text-on-surface',
    iconClassName: 'bg-primary text-on-primary',
  },
  {
    icon: 'BookOpen' as IconName,
    titleKey: 'hero.trustPills.diacritics',
    bodyKey: 'hero.trustPills.noAds',
    className: 'bottom-0 left-1/2 w-60 -translate-x-1/2 bg-surface-container-lowest text-on-surface',
    iconClassName: 'bg-primary text-on-primary',
  },
] as const

export function HeroSection() {
  const { t } = useTranslation('landing')
  const reduceMotion = useReducedMotion()

  return (
    <section className="bg-primary-wash text-on-surface">
      <div className="bg-primary text-on-primary">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-1 px-6 py-2 text-center text-xs font-semibold uppercase tracking-wide sm:flex-row sm:gap-3 lg:px-10">
          <span>{t('hero.utility.eyebrow')}</span>
          <span className="hidden h-1 w-1 rounded-full bg-on-primary/70 sm:block" aria-hidden="true" />
          <span className="normal-case tracking-normal">{t('hero.utility.message')}</span>
        </div>
      </div>

      <div className="bg-surface-container-lowest">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3" aria-label="EduPlay">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary shadow-soft-sm" aria-hidden="true">
              <Icon name="BookOpen" weight="fill" size="md" />
            </span>
            <span className="font-headline text-2xl font-bold tracking-tight text-primary-deep">
              EduPlay
            </span>
          </div>

          <div className="hidden items-center gap-7 text-sm font-semibold text-on-surface-variant lg:flex" aria-hidden="true">
            {navLinks.map((key) => (
              <span key={key}>{t(key)}</span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              href={ROUTES.AUTH.LOGIN}
              className="hidden sm:inline-flex"
            >
              {t('hero.ctaHaveAccount')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              href={ROUTES.AUTH.REGISTER}
              className="bg-primary text-on-primary hover:bg-primary-deep"
            >
              {t('hero.nav.demoCta')}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-12 pt-14 lg:px-10 lg:pb-16 lg:pt-20">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="mx-auto max-w-5xl text-center"
        >
          <motion.div
            variants={staggerItem}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-deep shadow-soft-sm"
          >
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            {t('hero.badge')}
          </motion.div>

          <motion.h1
            variants={staggerItem}
            aria-label={`${t('hero.titleLine1')} ${t('hero.titleLine2')}. ${t('hero.titleLine3')}`}
            className="mx-auto max-w-4xl font-headline text-[44px] font-bold leading-[1.03] tracking-tight text-on-surface md:text-[64px] lg:text-[76px]"
          >
            {t('hero.titleLine1')}{' '}
            <span>{t('hero.titleLine2')}.</span>{' '}
            <span className="text-primary">{t('hero.titleLine3')}</span>
          </motion.h1>

          <motion.p
            variants={staggerItem}
            className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-on-surface-variant md:text-xl"
          >
            {t('hero.description')}{' '}
            <strong className="font-semibold text-on-surface">{t('hero.descriptionStrong')}</strong>
          </motion.p>

          <motion.div variants={staggerItem} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              variant="primary"
              size="lg"
              href={ROUTES.AUTH.REGISTER}
              className="min-w-52 bg-primary text-on-primary"
            >
              {t('hero.ctaRegister')}
              <Icon name="ArrowRight" size="sm" aria-hidden />
            </Button>
            <Button
              variant="secondary"
              size="lg"
              href={ROUTES.AUTH.LOGIN}
              className="min-w-52 bg-surface-container-lowest text-on-surface"
            >
              {t('hero.ctaHaveAccount')}
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          className="relative mx-auto mt-12 min-h-[430px] max-w-5xl"
          aria-label={t('hero.visual.collageLabel')}
        >
          <div className="absolute left-1/2 top-8 w-[min(86vw,46rem)] -translate-x-1/2 rounded-xl bg-surface-container-lowest p-4 shadow-soft md:p-6">
            <div className="rounded-lg bg-primary-wash p-5 md:p-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    EduPlay
                  </p>
                  <h2 className="mt-2 max-w-md text-3xl font-bold leading-tight text-on-surface md:text-4xl">
                    {t('hero.visual.gameCount')} {t('hero.visual.gameLabel')}
                  </h2>
                  <p className="mt-3 max-w-sm text-base leading-relaxed text-on-surface-variant">
                    {t('hero.visual.gameSublabel')}
                  </p>
                </div>

                <div className="grid min-w-52 gap-2 text-left">
                  {(['colors', 'numbers', 'animals', 'letters'] as const).map((subject) => (
                    <div
                      key={subject}
                      className="flex items-center justify-between rounded-lg bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface shadow-soft-sm"
                    >
                      <span>{t(`hero.subjects.${subject}`)}</span>
                      <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {(['ro', 'gdpr', 'noAds'] as const).map((key) => (
                  <div
                    key={key}
                    className="rounded-lg bg-surface-container-lowest px-4 py-3 text-left text-sm font-semibold text-on-surface shadow-soft-sm"
                  >
                    {t(`hero.trustPills.${key}`)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {collageCards.map((card, index) => (
            <motion.div
              key={card.titleKey}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + index * 0.06, duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className={`absolute hidden rounded-lg p-4 shadow-soft md:block ${card.className}`}
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${card.iconClassName}`}>
                <Icon name={card.icon} weight="fill" size="md" aria-hidden />
              </div>
              <h3 className="mt-4 text-base font-bold leading-snug">
                {t(card.titleKey)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed opacity-80">
                {t(card.bodyKey)}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
