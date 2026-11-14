'use client'

import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { fadeInUp } from '@/config/animations'
import { Icon } from '@/shared/components/ui/Icon'
import { Button } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'

export function CTABanner() {
  const { t } = useTranslation('landing')

  return (
    <section
      className="relative overflow-hidden bg-primary"
      aria-labelledby="final-cta-heading"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 items-center gap-8 rounded-xl bg-surface-container-lowest p-6 text-on-surface shadow-soft lg:grid-cols-12 lg:p-10"
          data-testid="landing-final-cta-card"
        >
          <div className="lg:col-span-7">
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-on-primary"
            >
              <Icon name="Gift" weight="fill" size="xs" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                {t('finalCta.badge')}
              </span>
            </div>
            <h2
              id="final-cta-heading"
              aria-label={`${t('finalCta.titleLine1')} ${t('finalCta.titleLine2')}.`}
              className="font-headline text-[38px] font-bold leading-tight tracking-tight md:text-[54px]"
            >
              {t('finalCta.titleLine1')}{' '}
              <span>{t('finalCta.titleLine2')}.</span>
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-on-surface-variant lg:text-lg">
              {t('finalCta.description')}
            </p>
          </div>

          <div className="rounded-xl bg-primary-wash p-5 lg:col-span-5 lg:p-6" data-testid="landing-role-card">
            <p className="mb-4 text-sm font-bold uppercase tracking-wider text-primary">
              Începe cu rolul potrivit
            </p>
            <div className="flex flex-col gap-3">
              <Button variant="primary" size="lg" href={ROUTES.AUTH.REGISTER}>
                <Icon name="GraduationCap" size="sm" aria-hidden />
                {t('finalCta.ctaTeacher')}
              </Button>
              <Button variant="secondary" size="lg" href={ROUTES.AUTH.REGISTER}>
                <Icon name="Users" size="sm" aria-hidden />
                {t('finalCta.ctaParent')}
              </Button>
            </div>
            <p className="mt-5 text-sm text-on-surface-variant">
              {t('finalCta.haveAccount')}{' '}
              <Link
                href={ROUTES.AUTH.LOGIN}
                className="font-bold text-primary underline underline-offset-4 decoration-2 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-primary"
              >
                {t('finalCta.haveAccountLink')}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
