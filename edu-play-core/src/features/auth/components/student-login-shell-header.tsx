'use client';

import { useTranslation } from 'react-i18next';

export function StudentLoginShellHeader() {
  const { t } = useTranslation('auth');
  return (
    <header className="text-center">
      <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
        {t('login.studentPad.heading')}
      </h1>
    </header>
  );
}
