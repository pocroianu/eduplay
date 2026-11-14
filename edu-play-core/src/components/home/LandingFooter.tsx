'use client'

import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { ROUTES } from '@/shared/lib/constants'

const footerColumns = [
  {
    key: 'platform',
    titleKey: 'footer.columns.platform.title',
    links: [
      { labelKey: 'footer.columns.platform.register', href: ROUTES.AUTH.REGISTER },
      { labelKey: 'footer.columns.platform.teacherLogin', href: ROUTES.AUTH.LOGIN },
      { labelKey: 'footer.columns.platform.studentLogin', href: ROUTES.AUTH.STUDENT_LOGIN },
    ],
  },
  {
    key: 'learning',
    titleKey: 'footer.columns.learning.title',
    links: [
      { labelKey: 'footer.columns.learning.teachers', href: ROUTES.AUTH.REGISTER },
      { labelKey: 'footer.columns.learning.families', href: ROUTES.AUTH.REGISTER },
      { labelKey: 'footer.columns.learning.activities', href: ROUTES.AUTH.REGISTER },
    ],
  },
  {
    key: 'trust',
    titleKey: 'footer.columns.trust.title',
    links: [
      { labelKey: 'footer.columns.trust.privacy', href: '#' },
      { labelKey: 'footer.columns.trust.gdpr', href: '#' },
      { labelKey: 'footer.columns.trust.contact', href: '#' },
    ],
  },
] as const satisfies ReadonlyArray<{
  key: string
  titleKey: string
  links: readonly FooterLinkConfig[]
}>

const trustBadges = [
  { labelKey: 'footer.badges.romanian', icon: 'TextAa' as IconName },
  { labelKey: 'footer.badges.gdpr', icon: 'ShieldCheck' as IconName },
  { labelKey: 'footer.badges.primary', icon: 'GraduationCap' as IconName },
] as const

export function LandingFooter() {
  const { t } = useTranslation('landing')

  return (
    <footer className="relative overflow-hidden text-on-surface" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10 lg:py-16">
        <div className="grid grid-cols-1 gap-10 border-b border-outline-variant pb-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <Link
              href={ROUTES.HOME}
              className="mb-5 inline-flex items-baseline gap-2 rounded-md focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <span className="font-headline text-3xl font-bold leading-none tracking-tight text-on-surface">EduPlay</span>
              <span className="font-headline text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                .ro
              </span>
            </Link>
            <p className="max-w-md text-base leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              {t('footer.description')}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {trustBadges.map((badge) => (
                <span
                  key={badge.labelKey}
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-bold uppercase tracking-wider"
                >
                  <Icon name={badge.icon} weight="fill" size="xs" style={{ color: 'var(--color-primary)' }} />
                  {t(badge.labelKey)}
                </span>
              ))}
            </div>
          </div>

          <nav className="grid grid-cols-1 gap-8 sm:grid-cols-3 lg:col-span-7" aria-label={t('footer.navAria')}>
            {footerColumns.map((column) => (
              <FooterColumn key={column.key} title={t(column.titleKey)} links={column.links} />
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 pt-8 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>
              {t('footer.copyright')}
            </p>
            <p className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              {t('footer.madeInPrefix')}
              <Icon name="Heart" weight="fill" size="xs" style={{ color: 'var(--color-primary)' }} />
              {t('footer.madeInSuffix')}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface">
            <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
              {t('footer.diacriticsLetters')}
            </span>
            <span className="text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>
              {t('footer.diacriticsLabel')}
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

interface FooterLinkConfig {
  readonly labelKey: string
  readonly href: string
}

function FooterColumn({ title, links }: { title: string; links: readonly FooterLinkConfig[] }) {
  const { t } = useTranslation('landing')
  return (
    <div>
      <h2 className="mb-4 font-headline text-base font-bold tracking-tight text-on-surface">{title}</h2>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.labelKey}>
            <Link
              href={link.href}
              className="inline-flex min-h-10 items-center rounded-md text-sm font-semibold text-on-surface focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary hover:text-primary"
            >
              {t(link.labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
