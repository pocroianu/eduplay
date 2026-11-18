'use client';
import { Paper, UnstyledButton } from '@mantine/core';
import { MantineBoundary } from './MantineBoundary';
import type { MouseEventHandler, ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@/shared/components/ui/Icon';
import { cn } from '@/shared/lib/utils/cn';

export type LibraryExploreCardTone = 'purple' | 'green' | 'blue' | 'gold' | 'pink';
export type LibraryExploreCardVariant = 'activity' | 'collection';

export interface LibraryExploreCardProps {
  href: string;
  title: string;
  creator?: string;
  meta?: string;
  actionLabel?: string;
  onAction?: MouseEventHandler<HTMLButtonElement>;
  thumbnail?: ReactNode;
  tone?: LibraryExploreCardTone;
  variant?: LibraryExploreCardVariant;
  className?: string;
}

const TONE_CLASS: Record<LibraryExploreCardTone, string> = {
  purple: 'ep-explore-card__thumb--purple',
  green: 'ep-explore-card__thumb--green',
  blue: 'ep-explore-card__thumb--blue',
  gold: 'ep-explore-card__thumb--gold',
  pink: 'ep-explore-card__thumb--pink',
};

export function LibraryExploreCard({
  href,
  title,
  creator,
  meta,
  actionLabel,
  onAction,
  thumbnail,
  tone = 'purple',
  variant = 'activity',
  className,
}: LibraryExploreCardProps) {
  const isCollection = variant === 'collection';

  return (
    <MantineBoundary><Paper component="article" unstyled
      aria-label={title}
      className={cn(
        'ep-explore-card',
        isCollection && 'ep-explore-card--collection',
        className,
      )}
    >
      <Link href={href} className="ep-explore-card__main ep-interactive">
        <span className={cn('ep-explore-card__thumb', TONE_CLASS[tone])} aria-hidden>
          {thumbnail ?? (
            <span className="ep-explore-card__fallback">
              <Icon name="BookOpen" size={44} weight="fill" aria-hidden />
            </span>
          )}
        </span>
        <span className="ep-explore-card__body">
          {creator ? <span className="ep-explore-card__creator">{creator}</span> : null}
          <span className="ep-explore-card__title">{title}</span>
          {meta ? <span className="ep-explore-card__meta">{meta}</span> : null}
        </span>
      </Link>
      {actionLabel && onAction ? (
        <UnstyledButton type="button" className="ep-explore-card__action ep-interactive" onClick={onAction}>
          <Icon name="Star" size={20} weight="regular" aria-hidden />
          <span className="sr-only">{actionLabel}</span>
        </UnstyledButton>
      ) : null}
    </Paper></MantineBoundary>
  );
}
