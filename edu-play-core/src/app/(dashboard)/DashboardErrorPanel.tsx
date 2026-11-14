'use client';

import { Button } from '@mantine/core';
import Link from 'next/link';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';

export interface DashboardErrorPanelProps {
  error: Error & { digest?: string };
  reset: () => void;
  icon: IconName;
  title: string;
  message: string;
  retryLabel: string;
  homeHref: string;
  homeLabel: string;
  digestLabel?: string;
}

export function DashboardErrorPanel({
  error,
  reset,
  icon,
  title,
  message,
  retryLabel,
  homeHref,
  homeLabel,
  digestLabel,
}: DashboardErrorPanelProps) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-surface-container-lowest border border-outline-variant shadow-soft-sm rounded-xl p-8">
          <div className="flex flex-col gap-4 items-center text-center">
            <div className="text-error">
              <Icon name={icon} size={48} />
            </div>
            <h2 className="text-lg font-semibold text-on-surface">
              {title}
            </h2>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              {message}
            </p>
            <DashboardErrorActions
              reset={reset}
              retryLabel={retryLabel}
              homeHref={homeHref}
              homeLabel={homeLabel}
            />
            {error.digest && digestLabel && (
              <p className="text-xs text-on-surface-variant/50 mt-2">
                {digestLabel}: {error.digest}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardErrorActions({
  reset,
  retryLabel,
  homeHref,
  homeLabel,
}: {
  reset: () => void;
  retryLabel: string;
  homeHref: string;
  homeLabel: string;
}) {
  return (
    <div className="flex gap-3 mt-2">
      <Button
        color="purple"
        radius="xl"
        classNames={{
          root: 'px-5 text-on-primary',
          label: 'text-sm font-medium',
        }}
        onClick={reset}
      >
        {retryLabel}
      </Button>
      <Button
        component={Link}
        href={homeHref}
        color="gray"
        radius="xl"
        variant="light"
        classNames={{
          root: 'px-5 bg-surface-container text-on-surface-variant',
          label: 'text-sm font-medium',
        }}
      >
        {homeLabel}
      </Button>
    </div>
  );
}
