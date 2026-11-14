'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Vulpita } from '@/shared/components/ui/kit';

export interface FeedEmptyStateProps {
  filteredChildName: string | null;
}

export function FeedEmptyState({ filteredChildName }: FeedEmptyStateProps) {
  const reduceMotion = useReducedMotion();
  const { t } = useTranslation('parent');
  const headline = filteredChildName
    ? t('feed.empty.childHeadline', { name: firstName(filteredChildName) })
    : t('feed.empty.noneHeadline');
  const body = filteredChildName
    ? t('feed.empty.childBody')
    : t('feed.empty.noneBody');

  return (
    <div
      data-testid="family-feed-empty-state"
      className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-soft-sm"
    >
      <div className="grid md:grid-cols-[auto_1fr] items-center gap-6 px-6 py-10">
        <motion.div
          aria-hidden="true"
          animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
          transition={reduceMotion ? undefined : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="flex justify-center md:justify-start"
        >
          <Vulpita size={120} mood="happy" bandana="green" animate={!reduceMotion} />
        </motion.div>
        <div>
          <h3 className="text-2xl font-bold text-on-surface mb-2">{headline}</h3>
          <p className="text-on-surface-variant text-base max-w-md">{body}</p>
        </div>
      </div>
    </div>
  );
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(' ');
  return space === -1 ? trimmed : trimmed.slice(0, space);
}
