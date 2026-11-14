'use client';

import { Button as MantineButton, UnstyledButton } from '@mantine/core';
import { useState } from 'react';
import NextLink from 'next/link';
import { useTranslation } from 'react-i18next';
import { AuthShell } from '@/shared/components/ui/kit';
import { LoginForm, ParentLoginForm } from '@/features/auth';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';

type AdultRole = 'teacher' | 'parent';
type View = 'select' | AdultRole;

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const [view, setView] = useState<View>('select');

  if (view === 'select') {
    return (
      <AuthShell
        title={t('login.page.title')}
        subtitle={t('login.page.roleSelectSubtitle')}
        heroSlot={<LoginHero />}
        footerSlot={<RegisterPrompt />}
      >
        <RoleSelection onPick={(role) => setView(role)} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t(`login.page.roleHeading.${view}`)}
      subtitle={t(`login.page.roleSubtitle.${view}`)}
      heroSlot={
        <MantineButton
          type="button"
          variant="subtle"
          color="purple"
          size="sm"
          leftSection={<Icon name="ArrowLeft" size="sm" aria-hidden />}
          onClick={() => setView('select')}
        >
          {t('login.page.changeRole')}
        </MantineButton>
      }
      footerSlot={<RegisterPrompt />}
    >
      {view === 'teacher' ? <LoginForm idPrefix="teacher" /> : <ParentLoginForm />}
    </AuthShell>
  );
}

interface RoleOption {
  value: AdultRole | 'student';
  labelKey: string;
  descriptionKey: string;
  icon: IconName;
  tone: 'green' | 'gold' | 'purple';
  href?: string;
}

const ROLE_OPTIONS: ReadonlyArray<RoleOption> = [
  {
    value: 'teacher',
    labelKey: 'login.page.roles.teacher.label',
    descriptionKey: 'login.page.roles.teacher.description',
    icon: 'GraduationCap',
    tone: 'green',
  },
  {
    value: 'student',
    labelKey: 'login.page.roles.student.label',
    descriptionKey: 'login.page.roles.student.description',
    icon: 'Baby',
    tone: 'gold',
    href: ROUTES.AUTH.STUDENT_LOGIN,
  },
  {
    value: 'parent',
    labelKey: 'login.page.roles.parent.label',
    descriptionKey: 'login.page.roles.parent.description',
    icon: 'Users',
    tone: 'purple',
  },
];

interface RoleSelectionProps {
  onPick: (role: AdultRole) => void;
}

function RoleSelection({ onPick }: RoleSelectionProps) {
  const { t } = useTranslation('auth');

  return (
    <div className="flex flex-col gap-3" role="group" aria-label={t('login.page.roleTabsLabel')}>
      {ROLE_OPTIONS.map((option) => (
        <RoleOptionButton
          key={option.value}
          option={option}
          onPick={option.href ? undefined : () => onPick(option.value as AdultRole)}
        />
      ))}
    </div>
  );
}

function RoleOptionButton({
  option,
  onPick,
}: {
  option: RoleOption;
  onPick?: () => void;
}) {
  const { t } = useTranslation('auth');
  const content = (
    <>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ROLE_TONE_CLASSES[option.tone]}`}
        aria-hidden
      >
        <Icon name={option.icon} size="md" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="font-headline text-base font-semibold text-on-surface">
          {t(option.labelKey)}
        </span>
        <span className="text-left text-sm font-normal leading-snug text-on-surface-variant">
          {t(option.descriptionKey)}
        </span>
      </span>
      <Icon name="CaretRight" size="sm" aria-hidden className="shrink-0 text-on-surface-variant" />
    </>
  );

  if (option.href) {
    return (
      <UnstyledButton
        component={NextLink}
        href={option.href}
        data-testid={option.value === 'student' ? 'student-login-entry' : undefined}
        className={ROLE_OPTION_CLASS}
      >
        {content}
      </UnstyledButton>
    );
  }

  return (
    <UnstyledButton
      type="button"
      onClick={onPick}
      className={ROLE_OPTION_CLASS}
    >
      {content}
    </UnstyledButton>
  );
}

const ROLE_TONE_CLASSES: Record<RoleOption['tone'], string> = {
  green: 'bg-primary-soft text-primary-deep',
  gold: 'bg-gold-soft text-gold-deep',
  purple: 'bg-purple-soft text-purple-deep',
};

const ROLE_OPTION_CLASS = 'flex min-h-14 w-full items-center justify-start gap-3 rounded-md bg-surface-container-lowest px-4 py-3 text-left shadow-soft-sm transition-[background-color,color,box-shadow] hover:bg-primary-soft';

function LoginHero() {
  const { t } = useTranslation('auth');
  const features: ReadonlyArray<{ icon: IconName; label: string }> = [
    { icon: 'ShieldCheck', label: t('login.page.hero.features.gdpr') },
    { icon: 'GraduationCap', label: t('login.page.hero.features.curriculum') },
    { icon: 'Heart', label: t('login.page.hero.features.teachers') },
  ];

  return (
    <div className="text-primary-deep">
      <h2 className="font-headline text-2xl font-bold leading-tight tracking-tight md:text-3xl">
        {t('login.page.hero.titleLine1')}<br />{t('login.page.hero.titleLine2')}
      </h2>
      <p className="mt-3 text-base leading-relaxed md:text-lg">
        {t('login.page.hero.subtitle')}
      </p>
      <ul className="mt-5 flex flex-col gap-3">
        {features.map((item) => (
          <li key={item.label} className="flex items-center gap-3 text-sm font-semibold md:text-base">
            <Icon name={item.icon} weight="fill" aria-hidden className="text-primary-deep" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RegisterPrompt() {
  const { t } = useTranslation('auth');
  return (
    <p className="text-center text-on-surface-variant font-medium">
      {t('login.page.noAccountPrompt')}{' '}
      <MantineButton
        component={NextLink}
        href={ROUTES.AUTH.REGISTER}
        variant="subtle"
        color="purple"
        size="sm"
        className="align-baseline"
      >
        {t('login.page.registerLink')}
      </MantineButton>
    </p>
  );
}
