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
  purple: 'seesaw-explore-card__thumb--purple',
  green: 'seesaw-explore-card__thumb--green',
  blue: 'seesaw-explore-card__thumb--blue',
  gold: 'seesaw-explore-card__thumb--gold',
  pink: 'seesaw-explore-card__thumb--pink',
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
    <article
      aria-label={title}
      className={cn(
        'seesaw-explore-card',
        isCollection && 'seesaw-explore-card--collection',
        className,
      )}
    >
      <Link href={href} className="seesaw-explore-card__main seesaw-interactive">
        <span className={cn('seesaw-explore-card__thumb', TONE_CLASS[tone])} aria-hidden>
          {thumbnail ?? (
            <span className="seesaw-explore-card__fallback">
              <Icon name="BookOpen" size={44} weight="fill" aria-hidden />
            </span>
          )}
        </span>
        <span className="seesaw-explore-card__body">
          {creator ? <span className="seesaw-explore-card__creator">{creator}</span> : null}
          <span className="seesaw-explore-card__title">{title}</span>
          {meta ? <span className="seesaw-explore-card__meta">{meta}</span> : null}
        </span>
      </Link>
      {actionLabel && onAction ? (
        <button type="button" className="seesaw-explore-card__action seesaw-interactive" onClick={onAction}>
          <Icon name="Star" size={20} weight="regular" aria-hidden />
          <span className="sr-only">{actionLabel}</span>
        </button>
      ) : null}
    </article>
  );
}
