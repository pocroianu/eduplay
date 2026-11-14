'use client';

import { useMemo } from 'react';
import { Button } from '@mantine/core';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { staggerContainer, staggerItem } from '@/config/animations';
import { formatActivityDayGroupLabel, formatTime } from '@/lib/i18n/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArtifactCardType = 'drawing' | 'photo' | 'audio' | 'video' | 'other';

export interface GameProgressFeedItem {
  kind: 'activity_progress';
  id: string;
  studentName: string;
  studentAvatar: string | null;
  gameTitle: string;
  timestamp: string;
  score: number | null;
  status: 'completed' | 'in_progress' | 'not_started';
}

export interface ArtifactFeedItem {
  kind: 'artifact';
  id: string;
  studentName: string;
  studentAvatar: string | null;
  artifactId: string;
  artifactTitle: string | null;
  artifactType: ArtifactCardType;
  thumbnailUrl: string | null;
  timestamp: string;
}

export type FeedItem = GameProgressFeedItem | ArtifactFeedItem;

interface ActivityFeedProps {
  activities: FeedItem[];
  /** Maximum number of items to display before showing a "Vezi Toate" button. Default: 10. */
  maxItems?: number;
  /** Callback when "Vezi Toate" is clicked. If not provided, the button is hidden even when truncated. */
  onViewAll?: () => void;
}

const ARTIFACT_TYPE_ICON: Record<ArtifactCardType, IconName> = {
  drawing: 'Palette',
  photo: 'Camera',
  audio: 'MusicNote',
  video: 'PlayCircle',
  other: 'Sparkle',
};

const ARTIFACT_TYPE_LABEL: Record<ArtifactCardType, string> = {
  drawing: 'Desen',
  photo: 'Fotografie',
  audio: 'Înregistrare audio',
  video: 'Înregistrare video',
  other: 'Lucrare',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByDate(activities: FeedItem[]): Map<string, FeedItem[]> {
  const groups = new Map<string, FeedItem[]>();

  for (const activity of activities) {
    const label = formatActivityDayGroupLabel(activity.timestamp);

    const existing = groups.get(label) ?? [];
    existing.push(activity);
    groups.set(label, existing);
  }

  return groups;
}

function getActivityDescription(
  studentName: string,
  gameTitle: string,
  status: GameProgressFeedItem['status']
): string {
  switch (status) {
    case 'completed':
      return `${studentName} a completat "${gameTitle}"`;
    case 'in_progress':
      return `${studentName} joacă "${gameTitle}"`;
    case 'not_started':
      return `${studentName} a deschis "${gameTitle}"`;
    default:
      return `${studentName} - "${gameTitle}"`;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StudentAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  return (
    <div className="relative w-8 h-8 rounded-full bg-primary-soft text-primary-deep flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name} fill className="object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

function GameProgressRow({ activity }: { activity: GameProgressFeedItem }) {
  return (
    <motion.div
      variants={staggerItem}
      className="flex items-start gap-3 rounded-md px-3 py-3 transition-colors duration-200 hover:bg-surface-alt"
      data-testid="activity-feed-game"
    >
      <div className="flex flex-col items-center pt-1">
        <StudentAvatar
          name={activity.studentName}
          avatarUrl={activity.studentAvatar}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-on-surface line-clamp-2">
          {getActivityDescription(
            activity.studentName,
            activity.gameTitle,
            activity.status
          )}
        </p>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-outline">
            {formatTime(activity.timestamp)}
          </span>

          {activity.status === 'completed' && activity.score !== null && (
            <span className="inline-flex items-center gap-1 bg-gold-soft text-gold-deep text-xs px-2 rounded-full">
              <Icon name="Trophy" size={12} />
              {activity.score}%
            </span>
          )}

          {activity.status === 'in_progress' && (
            <span className="bg-primary-soft text-primary-deep text-xs px-2 rounded-full">
              În progres
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ArtifactRow({ activity }: { activity: ArtifactFeedItem }) {
  const typeLabel = ARTIFACT_TYPE_LABEL[activity.artifactType];
  const typeIcon = ARTIFACT_TYPE_ICON[activity.artifactType];
  const title = activity.artifactTitle?.trim() || typeLabel;

  return (
    <motion.div
      variants={staggerItem}
      className="flex items-start gap-3 rounded-md px-3 py-3 transition-colors duration-200 hover:bg-surface-alt"
      data-testid="activity-feed-artifact"
    >
      <div className="flex flex-col items-center pt-1">
        <StudentAvatar
          name={activity.studentName}
          avatarUrl={activity.studentAvatar}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-alt flex items-center justify-center">
            {activity.thumbnailUrl ? (
              <Image
                src={activity.thumbnailUrl}
                alt={title}
                fill
                unoptimized
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <Icon
                name={typeIcon}
                size={22}
                className="text-on-surface-variant"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-on-surface line-clamp-2">
              <span className="font-bold">{activity.studentName}</span>{' '}
              are o lucrare nouă: „{title}”.
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-outline">
                {formatTime(activity.timestamp)}
              </span>
              <span className="inline-flex items-center gap-1 bg-primary-soft text-primary-deep text-xs px-2 rounded-full">
                <Icon name={typeIcon} size={12} />
                {typeLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FeedRow({ activity }: { activity: FeedItem }) {
  if (activity.kind === 'artifact') {
    return <ArtifactRow activity={activity} />;
  }
  return <GameProgressRow activity={activity} />;
}

interface DateGroupProps {
  label: string;
  items: FeedItem[];
}

function DateGroup({ label, items }: DateGroupProps) {
  return (
    <div>
      <div className="mb-2 mt-4 flex items-center gap-2">
        <Icon name="Calendar" size={14} className="text-outline" />
        <span className="text-xs font-bold uppercase tracking-wider text-outline">
          {label}
        </span>
      </div>

      <div className="flex flex-col">
        {items.map((activity) => (
          <FeedRow key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityFeed({
  activities,
  maxItems = 10,
  onViewAll,
}: ActivityFeedProps) {
  const hasMore = activities.length > maxItems;
  const visibleActivities = hasMore ? activities.slice(0, maxItems) : activities;

  const dateGroups = useMemo(
    () => groupByDate(visibleActivities),
    [visibleActivities]
  );

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-surface-container-lowest border border-outline-variant shadow-soft-sm px-6 py-12">
        <Icon name="GameController" size={48} className="text-outline-variant mb-3" />
        <h4 className="text-sm font-semibold text-on-surface-variant mb-1">
          Nicio activitate recentă
        </h4>
        <p className="text-sm text-outline text-center">
          Activitățile copiilor vor apărea aici pe măsură ce joacă
        </p>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <div className="flex flex-col">
        {Array.from(dateGroups.entries()).map(([label, items]) => (
          <DateGroup key={label} label={label} items={items} />
        ))}
      </div>

      {hasMore && onViewAll && (
        <motion.div
          variants={staggerItem}
          className="flex justify-center mt-4"
        >
          <Button
            color="purple"
            h={44}
            radius="md"
            size="sm"
            variant="subtle"
            classNames={{
              root: 'px-4 text-primary hover:bg-primary-soft/40',
              label: 'text-sm font-medium',
            }}
            onClick={onViewAll}
          >
            Vezi Toate ({activities.length})
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
