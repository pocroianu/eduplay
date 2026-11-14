'use client';

import { Button, ThemeIcon } from '@mantine/core';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { BackgroundGlyph, DuoAvatar, DuoCard, RewardGlyph } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import { ROUTES } from '@/shared/lib/constants';

interface LeaderboardEntry {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  totalScore: number;
}

interface RewardsLeaderboardPanelProps {
  leaderboard: LeaderboardEntry[];
  classId?: string;
}

const ENABLED_ROW_MOTION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
} as const;

const DISABLED_ROW_MOTION = {
  initial: undefined,
  animate: undefined,
} as const;

const RANK_STYLES = [
  {
    bg: 'bg-gold/10',
    rank: 'text-gold',
    marker: <RewardGlyph kind="trophy" size={20} />,
  },
  {
    bg: 'bg-primary/10',
    rank: 'text-primary',
    marker: <Icon name="Medal" size={18} weight="bold" aria-hidden />,
  },
  {
    bg: 'bg-coral/10',
    rank: 'text-coral',
    marker: <Icon name="Medal" size={18} weight="bold" aria-hidden />,
  },
] as const;

function RankBadge({ index }: { index: number }) {
  const style = RANK_STYLES[index];
  if (!style) {
    return (
      <span className="text-lg font-bold w-7 text-center text-on-surface-variant">
        #{index + 1}
      </span>
    );
  }

  return (
    <ThemeIcon
      component="span"
      size={28}
      radius="xl"
      variant="transparent"
      className={`${style.bg} ${style.rank}`}
      aria-label={`Locul ${index + 1}`}
    >
      {style.marker}
    </ThemeIcon>
  );
}

function LeaderboardAvatar({ entry }: { entry: LeaderboardEntry }) {
  if (!entry.avatarUrl) {
    return <DuoAvatar name={entry.fullName} size={36} />;
  }

  return (
    <Image
      src={entry.avatarUrl}
      alt={entry.fullName}
      width={36}
      height={36}
      className="h-9 w-9 rounded-full object-cover shrink-0"
    />
  );
}

function LeaderboardRow({
  entry,
  index,
  pointsLabel,
  reduceMotion,
}: {
  entry: LeaderboardEntry;
  index: number;
  pointsLabel: string;
  reduceMotion: boolean;
}) {
  const motionProps = reduceMotion ? DISABLED_ROW_MOTION : ENABLED_ROW_MOTION;
  const rowBg = RANK_STYLES[index]?.bg ?? 'bg-surface-container';

  return (
    <motion.div
      key={entry.id}
      initial={motionProps.initial}
      animate={motionProps.animate}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={`flex items-center gap-3 rounded-2xl p-4 ${rowBg}`}
    >
      <RankBadge index={index} />
      <LeaderboardAvatar entry={entry} />
      <span className="text-sm font-bold flex-1 truncate">{entry.fullName}</span>
      <span className="text-sm font-bold text-on-surface-variant">{pointsLabel}</span>
    </motion.div>
  );
}

export function RewardsLeaderboardPanel({
  leaderboard,
  classId,
}: RewardsLeaderboardPanelProps) {
  const { t } = useTranslation('teacher');
  const reduceMotion = useReducedMotion();

  return (
    <DuoCard className="relative overflow-hidden p-8 lg:p-10 text-on-surface">
      {/* Decorative background */}
      <div className="absolute -top-2 -left-4 pointer-events-none">
        <BackgroundGlyph kind="dotGrid" tone="purple" size={100} opacity={0.06} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple/10 text-purple">
            <Icon name="Trophy" size="lg" weight="bold" />
          </div>
          <h3 className="font-headline text-lg font-bold">
            {t('classes.detail.leaderboard.heading')}
          </h3>
        </div>
        <p className="mb-6 text-xs text-on-surface-variant pl-[52px]">
          {t('classes.detail.leaderboard.subtitle')}
        </p>

        <div className="flex flex-col gap-3">
          {leaderboard.map((entry, index) => (
            <LeaderboardRow
              key={entry.id}
              entry={entry}
              index={index}
              pointsLabel={t('classes.detail.leaderboard.points', { count: entry.totalScore })}
              reduceMotion={reduceMotion === true}
            />
          ))}
        </div>

        {leaderboard.length === 0 && (
          <div className="py-6 text-center">
            <Icon name="Trophy" size="xl" className="text-on-surface-variant/30 mx-auto mb-2" />
            <p className="text-sm text-on-surface-variant">
              {t('classes.detail.leaderboard.empty')}
            </p>
          </div>
        )}

        {leaderboard.length > 0 && classId && (
          <Button
            component={Link}
            href={ROUTES.TEACHER.STUDENTS}
            fullWidth
            radius="xl"
            variant="subtle"
            color="purple"
            className="mt-6"
            leftSection={<Icon name="ChartBar" size="sm" weight="bold" aria-hidden />}
            styles={{
              root: {
                minHeight: 44,
                backgroundColor: 'var(--color-surface-container)',
                color: 'var(--color-purple)',
                fontSize: 'var(--text-body-sm)',
                fontWeight: 700,
              },
            }}
          >
            {t('classes.detail.leaderboard.viewAll')}
          </Button>
        )}
      </div>
    </DuoCard>
  );
}
