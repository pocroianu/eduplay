'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Pill,
} from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import { formatRelativeTime } from '@/lib/i18n/formatters';
import { staggerContainer, staggerItem } from '@/config/animations';
import type { EnrichedFeedItem } from '../types';

export interface FeedTimelineProps {
  items: EnrichedFeedItem[];
}

export function FeedTimeline({ items }: FeedTimelineProps) {
  const reduceMotion = useReducedMotion();

  if (items.length === 0) {
    return null;
  }

  return (
    <motion.ul
      data-testid="family-feed-timeline"
      className="flex flex-col gap-5 list-none p-0 m-0"
      initial={reduceMotion ? false : 'hidden'}
      animate="visible"
      variants={reduceMotion ? undefined : staggerContainer}
    >
      {items.map((entry) => (
        <motion.li
          key={`${entry.kind}:${entry.item.id}`}
          data-feed-kind={entry.kind}
          data-feed-timestamp={entry.item.timestamp}
          variants={reduceMotion ? undefined : staggerItem}
        >
          <FeedCard entry={entry} />
        </motion.li>
      ))}
    </motion.ul>
  );
}

function FeedCard({ entry }: { entry: EnrichedFeedItem }) {
  const { item } = entry;
  return (
    <Card
      padding="none"
      className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-soft-sm"
    >
      <header className="flex items-start gap-3 border-b border-outline-variant bg-surface-container-lowest px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-deep">
          {item.studentName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-on-surface">
            {item.studentName}
          </p>
          <time
            className="text-xs text-on-surface-variant"
            dateTime={item.timestamp}
            suppressHydrationWarning
          >
            {formatRelativeTime(item.timestamp)}
          </time>
        </div>
        <FeedKindBadge entry={entry} />
      </header>
      <div
        data-testid="feed-card-body"
        className="bg-surface-alt px-4 py-4"
      >
        <div className="max-w-[min(100%,42rem)] rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-soft-sm">
          {entry.kind === 'artifact_published' ? (
            <ArtifactBody entry={entry} />
          ) : (
            <GameBody entry={entry} />
          )}
        </div>
      </div>
    </Card>
  );
}

function FeedKindBadge({ entry }: { entry: EnrichedFeedItem }) {
  const { t } = useTranslation('parent');

  if (entry.kind === 'artifact_published') {
    return (
      <Pill
        tone="lime"
        leading={<Icon name="Sparkle" size={12} weight="fill" />}
      >
        {t('feed.badgeArtifact')}
      </Pill>
    );
  }
  return (
    <Pill
      tone="sun"
      leading={<Icon name="GameController" size={12} weight="fill" />}
    >
      {t('feed.badgeGame')}
    </Pill>
  );
}

function ArtifactBody({
  entry,
}: {
  entry: Extract<EnrichedFeedItem, { kind: 'artifact_published' }>;
}) {
  const { item, mediaUrl } = entry;
  const { t } = useTranslation('parent');
  const title = item.title?.trim() || defaultArtifactTitle(item.artifactType, t);

  return (
    <div className="flex flex-col gap-3">
      {mediaUrl ? (
        <ArtifactMedia
          artifactType={item.artifactType}
          mediaUrl={mediaUrl}
          alt={title}
        />
      ) : (
        <ArtifactMediaUnavailable artifactType={item.artifactType} />
      )}
      <p className="text-base font-bold text-on-surface">{title}</p>
    </div>
  );
}

function ArtifactMedia({
  artifactType,
  mediaUrl,
  alt,
}: {
  artifactType: string;
  mediaUrl: string;
  alt: string;
}) {
  if (artifactType === 'photo' || artifactType === 'drawing') {
    return (
      <div className="relative w-full overflow-hidden rounded-lg bg-surface-container aspect-[4/3]">
        <Image
          src={mediaUrl}
          alt={alt}
          fill
          unoptimized
          sizes="(min-width: 1280px) 640px, 100vw"
          className="object-cover"
        />
      </div>
    );
  }
  if (artifactType === 'audio') {
    return (
      <audio
        controls
        preload="metadata"
        src={mediaUrl}
        className="w-full"
        aria-label={alt}
      >
        Browserul tău nu acceptă redarea audio.
      </audio>
    );
  }
  if (artifactType === 'video') {
    return (
      <video
        controls
        preload="metadata"
        src={mediaUrl}
        className="w-full rounded-lg bg-on-surface aspect-video"
        aria-label={alt}
      >
        Browserul tău nu acceptă redarea video.
      </video>
    );
  }
  return <ArtifactMediaUnavailable artifactType={artifactType} />;
}

function ArtifactMediaUnavailable({ artifactType }: { artifactType: string }) {
  const { t } = useTranslation('parent');
  const icon =
    artifactType === 'audio'
      ? 'MusicNote'
      : artifactType === 'video'
        ? 'PlayCircle'
        : artifactType === 'drawing'
          ? 'Palette'
          : 'Camera';
  return (
    <div
      className="flex items-center justify-center rounded-lg bg-surface-container text-on-surface-variant gap-2 px-4 py-8"
      role="status"
    >
      <Icon name={icon} size={20} weight="duotone" />
      <span className="text-sm">
        {artifactType === 'audio'
          ? t('feed.unavailableAudio')
          : artifactType === 'video'
            ? t('feed.unavailableVideo')
            : t('feed.unavailablePhoto')}
      </span>
    </div>
  );
}

function GameBody({
  entry,
}: {
  entry: Extract<EnrichedFeedItem, { kind: 'game_completed' }>;
}) {
  const { item } = entry;
  const { t } = useTranslation('parent');
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold-deep">
        <Icon name="Trophy" size={18} weight="duotone" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-on-surface">
          {item.gameTitle}
        </p>
        <p className="text-xs text-on-surface-variant">
          {t('feed.gameSubtitle')}
        </p>
      </div>
      {item.score !== null && (
        <Pill tone="sun" leading={<Icon name="Star" size={12} weight="fill" />}>
          {`${item.score}%`}
        </Pill>
      )}
    </div>
  );
}

function defaultArtifactTitle(
  artifactType: string,
  t: (key: string) => string,
): string {
  switch (artifactType) {
    case 'photo':
      return t('feed.defaultPhotoTitle');
    case 'drawing':
      return t('feed.defaultDrawingTitle');
    case 'audio':
      return t('feed.defaultAudioTitle');
    case 'video':
      return t('feed.defaultVideoTitle');
    default:
      return t('feed.defaultArtifactTitle');
  }
}
