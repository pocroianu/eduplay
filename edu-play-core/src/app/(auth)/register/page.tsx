'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AuthShell,
  SegmentedTabs,
  type SegmentedTab,
} from '@/shared/components/ui/kit';
import { AuthInlineLink, RegisterForm, ParentRegisterForm } from '@/features/auth';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';

export default function RegisterPage() {
  const { t } = useTranslation('auth');
  const [role, setRole] = useState<'teacher' | 'parent'>('teacher');

  const tabs: SegmentedTab[] = [
    { value: 'teacher', label: t('register.page.tabs.teacher'), icon: 'GraduationCap' },
    { value: 'parent', label: t('register.page.tabs.parent'), icon: 'Users' },
  ];

  return (
    <AuthShell
      title={t('register.page.title')}
      subtitle={t('register.page.subtitle')}
      heroSlot={<RegisterHero />}
      footerSlot={<RegisterFooter />}
      className="bg-surface-container"
    >
      <div className="flex flex-col gap-4">
        <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('register.page.sectionLabel')}
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {t('register.page.sectionDescription')}
            </p>
          </div>
          <div className="flex flex-col gap-5 p-4">
            <SegmentedTabs
              tabs={tabs}
              value={role}
              onChange={(next) => setRole(next as 'teacher' | 'parent')}
              ariaLabel={t('register.page.roleTabsLabel')}
            />

            {role === 'teacher' ? <RegisterForm /> : <ParentRegisterForm />}
          </div>
        </section>

        {role === 'teacher' && (
          <section className="rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                <Icon name="GraduationCap" size={18} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  {t('register.page.teacherHelper.title')}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                  {t('register.page.teacherHelper.body')}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </AuthShell>
  );
}

function RegisterHero() {
  const { t } = useTranslation('auth');
  const features: ReadonlyArray<{ icon: IconName; label: string }> = [
    { icon: 'ShieldCheck', label: t('register.page.hero.features.gdpr') },
    { icon: 'GraduationCap', label: t('register.page.hero.features.curriculum') },
    { icon: 'Heart', label: t('register.page.hero.features.teachers') },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
      <div className="border-b border-outline-variant px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          {t('register.page.hero.label')}
        </p>
      </div>
      <div className="p-4">
        <p className="font-headline text-2xl font-semibold leading-tight tracking-tight text-on-surface md:text-3xl">
          {t('register.page.hero.titleLine1')}<br />{t('register.page.hero.titleLine2')}
        </p>
        <p className="mt-3 text-base leading-relaxed text-on-surface-variant md:text-lg">
          {t('register.page.hero.subtitle')}
        </p>
        <ul className="mt-5 divide-y divide-outline-variant rounded-md border border-outline-variant">
          {features.map((item) => (
            <li key={item.label} className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-on-surface md:text-base">
              <Icon name={item.icon} aria-hidden className="text-primary" />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RegisterFooter() {
  const { t } = useTranslation('auth');
  return (
    <p className="text-center text-on-surface-variant font-medium">
      {t('register.page.alreadyHaveAccount')}{' '}
      <AuthInlineLink href={ROUTES.AUTH.LOGIN}>
        {t('register.page.loginLink')}
      </AuthInlineLink>
    </p>
  );
}
