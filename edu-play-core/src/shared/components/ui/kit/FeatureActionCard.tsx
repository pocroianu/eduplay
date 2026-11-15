import { Card as MantineCard } from '@mantine/core';
import { MantineBoundary } from './MantineBoundary';
import Link from 'next/link';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { cn } from '@/shared/lib/utils/cn';

export type FeatureActionCardTone =
  | 'journal'
  | 'create'
  | 'generate'
  | 'message'
  | 'neutral';

const TONE_CLASS: Record<FeatureActionCardTone, string> = {
  journal: 'bg-success-journal text-on-success',
  create: 'bg-primary text-on-primary',
  generate: 'bg-blue-deep text-white',
  message: 'bg-surface-container-lowest text-on-surface',
  neutral: 'bg-surface-container-lowest text-on-surface',
};

const ICON_CHROME_CLASS: Record<FeatureActionCardTone, string> = {
  journal: 'bg-white/20 text-on-success',
  create: 'bg-white/20 text-on-primary',
  generate: 'bg-white/20 text-white',
  message: 'bg-primary-wash text-primary',
  neutral: 'bg-primary-wash text-primary',
};

export interface FeatureActionCardProps {
  href: string;
  icon: IconName;
  title: string;
  subtitle: string;
  tone?: FeatureActionCardTone;
  className?: string;
}

export function FeatureActionCard({
  href,
  icon,
  title,
  subtitle,
  tone = 'neutral',
  className,
}: FeatureActionCardProps) {
  return (
    <MantineBoundary>
    <MantineCard component={Link} unstyled
      href={href}
      className={cn(
        'group flex min-h-32 flex-col justify-between rounded-xl p-5 shadow-soft-sm transition-[background-color,box-shadow,color] duration-200 ease-standard hover:shadow-soft-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        TONE_CLASS[tone],
        className,
      )}
    >
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-lg',
          ICON_CHROME_CLASS[tone],
        )}
        aria-hidden="true"
      >
        <Icon name={icon} size="xl" weight="fill" aria-hidden />
      </span>
      <span>
        <span className="block text-base font-bold leading-tight">{title}</span>
        <span className="mt-1 block text-sm font-medium opacity-85">
          {subtitle}
        </span>
      </span>
    </MantineCard>
    </MantineBoundary>
  );
}
