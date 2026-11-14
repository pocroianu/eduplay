import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';

export interface ActivityCardProps {
  href: string;
  title: string;
  creator: string;
  meta: string;
  imageAlt: string;
  image?: ReactNode;
  className?: string;
}

export function ActivityCard({
  href,
  title,
  creator,
  meta,
  imageAlt,
  image,
  className,
}: ActivityCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group block overflow-hidden rounded-xl bg-surface-container-lowest shadow-soft-sm transition-shadow duration-200 ease-standard hover:shadow-soft-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      )}
    >
      <span
        className="relative block h-36 overflow-hidden rounded-b-xl bg-blue-soft"
        role={image ? undefined : 'img'}
        aria-label={image ? undefined : imageAlt}
      >
        {image}
        <span className="absolute bottom-3 left-3 rounded-pill bg-white/95 px-3 py-1 text-xs font-semibold text-on-surface shadow-soft-sm">
          {meta}
        </span>
      </span>
      <span className="block p-4">
        <span className="line-clamp-2 block text-base font-bold leading-snug text-on-surface">
          {title}
        </span>
        <span className="mt-2 block text-sm text-on-surface-variant">
          {creator}
        </span>
      </span>
    </Link>
  );
}
