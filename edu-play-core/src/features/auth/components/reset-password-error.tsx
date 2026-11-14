'use client';

import { Button as MantineButton } from '@mantine/core';
import NextLink from 'next/link';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/shared/components/ui/Icon';
import { ROUTES } from '@/shared/lib/constants/routes';

export function ResetPasswordError({
  errorDescription,
}: {
  errorDescription?: string;
}) {
  const { t } = useTranslation('auth');

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('resetPassword.error.label')}
          </p>
        </div>
        <div className="flex items-start gap-3 p-4">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-error-soft text-error"
          >
            <Icon name="Link" weight="fill" size={22} />
          </span>
          <div>
            <h3 className="font-headline text-lg font-semibold text-on-surface">
              {t('resetPassword.error.title')}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              {errorDescription
                ? decodeURIComponent(errorDescription)
                : t('resetPassword.error.fallbackBody')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <MantineButton
          component={NextLink}
          href={ROUTES.AUTH.FORGOT_PASSWORD}
          data-testid="request-new-link"
          color="purple"
        >
          {t('resetPassword.error.requestNewLink')}
        </MantineButton>

        <MantineButton
          component={NextLink}
          href={ROUTES.AUTH.LOGIN}
          variant="subtle"
          color="purple"
        >
          {t('resetPassword.error.backToLogin')}
        </MantineButton>
      </div>
    </div>
  );
}
