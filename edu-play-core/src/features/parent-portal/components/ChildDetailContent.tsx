'use client';

import { useMemo, useState } from 'react';
import { Tabs } from '@mantine/core';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { ChildConsentSection } from './ChildConsentSection';
import { ROUTES } from '@/shared/lib/constants';
import { formatDateLong } from '@/lib/i18n/formatters';
import type { ProgressSummary } from '../queries/types';
import type { GameWithProgress } from '@/features/games';
import type { ConsentMap } from '@/features/activities';
import { ActivityFeed } from './activity-feed';
import { GameProgressList } from './game-progress-list';
import classes from './ChildDetailContent.module.css';

interface ChildInfo {
  id: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

import type { FeedItem as ActivityItemForFeed } from './activity-feed';

const CHILD_DETAIL_TABS = [
  {
    value: 'progress',
    label: 'Progres',
    eyebrow: 'Progres',
    heading: 'Rezumat progres',
  },
  {
    value: 'games',
    label: 'Jocuri',
    eyebrow: 'Jocuri',
    heading: 'Jocurile copilului',
  },
  {
    value: 'activity',
    label: 'Activitate',
    eyebrow: 'Activitate',
    heading: 'Fir de activitate',
  },
] as const;

type ChildDetailTabValue = (typeof CHILD_DETAIL_TABS)[number]['value'];

interface ChildDetailContentProps {
  profile: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    avatar_url?: string | null;
  };
  child: ChildInfo;
  stats: ProgressSummary;
  gamesWithProgress: GameWithProgress[];
  recentActivity: ActivityItemForFeed[];
  consents: ConsentMap;
}

function calculateStreak(activities: ActivityItemForFeed[]): number {
  if (activities.length === 0) return 0;

  const activityDays = new Set<string>();
  for (const activity of activities) {
    if (!activity.timestamp) continue;
    const date = new Date(activity.timestamp);
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    activityDays.add(dayKey);
  }

  if (activityDays.size === 0) return 0;

  const sortedDays = Array.from(activityDays).sort().reverse();

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(today.getTime() - 86_400_000);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const mostRecentDay = sortedDays[0];
  if (mostRecentDay !== todayKey && mostRecentDay !== yesterdayKey) {
    return 0;
  }

  let streak = 0;
  let currentDate = new Date(mostRecentDay + 'T00:00:00');

  while (true) {
    const currentKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    if (activityDays.has(currentKey)) {
      streak++;
      currentDate = new Date(currentDate.getTime() - 86_400_000);
    } else {
      break;
    }
  }

  return streak;
}

function formatMemberSince(isoDate: string): string {
  try {
    return formatDateLong(isoDate);
  } catch {
    return 'necunoscut';
  }
}

interface OverviewStatCardProps {
  label: string;
  value: string | number;
  icon: IconName;
  iconClassName: string;
}

function OverviewStatCard({ label, value, icon, iconClassName }: OverviewStatCardProps) {
  return (
    <div className="min-h-[126px] rounded-xl bg-surface-container-lowest border border-outline-variant shadow-soft-sm">
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
              {label}
            </p>
            <p className="text-[28px] leading-none font-bold text-on-surface">
              {value}
            </p>
          </div>
          <div
            className={`w-[44px] h-[44px] rounded-md flex items-center justify-center shrink-0 ${iconClassName}`}
          >
            <Icon name={icon} size={22} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChildDetailContent({
  child,
  stats,
  gamesWithProgress,
  recentActivity,
  consents,
}: ChildDetailContentProps) {
  const streak = useMemo(() => calculateStreak(recentActivity), [recentActivity]);

  const [activeTab, setActiveTab] = useState<ChildDetailTabValue>('progress');
  const activeTabDefinition =
    CHILD_DETAIL_TABS.find((tab) => tab.value === activeTab) ??
    CHILD_DETAIL_TABS[0];

  const statCards: OverviewStatCardProps[] = [
    {
      label: 'Completate',
      value: stats.completedGames,
      icon: 'Trophy',
      iconClassName: 'bg-gold-soft text-gold-deep',
    },
    {
      label: 'În progres',
      value: stats.inProgressGames,
      icon: 'GameController',
      iconClassName: 'bg-primary-soft text-primary-deep',
    },
    {
      label: 'Scor mediu',
      value: stats.averageScore > 0 ? `${stats.averageScore}%` : '—',
      icon: 'Star',
      iconClassName: 'bg-blue-soft text-blue-deep',
    },
    {
      label: 'Zile consecutive',
      value: streak,
      icon: 'Fire',
      iconClassName: 'bg-coral-soft text-coral-deep',
    },
  ];

  return (
    <div className="bg-surface-alt p-6 lg:p-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Link
            href={ROUTES.PARENT.DASHBOARD}
            className="inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant transition-colors hover:text-primary"
          >
            <Icon name="ArrowLeft" size={16} aria-hidden />
            Înapoi la panou
          </Link>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-soft-sm"
        >
          <div className="flex flex-col gap-5 border-b border-outline-variant px-5 py-5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-xl font-bold text-primary-deep">
                {child.avatarUrl ? (
                  <Image src={child.avatarUrl} alt={child.name} fill sizes="64px" className="object-cover" />
                ) : (
                  child.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary-deep">
                  Fir copil
                </p>
                <h1 className="mt-1 truncate text-[28px] font-bold leading-tight text-on-surface md:text-[34px]">
                  {child.name}
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Membru din: {formatMemberSince(child.createdAt)}
                </p>
              </div>
            </div>
            {streak > 0 && (
              <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-alt px-4 py-2 text-sm font-bold text-on-surface">
                <Icon name="Fire" size={18} aria-hidden />
                {streak === 1 ? '1 zi consecutivă' : `${streak} zile consecutive`}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 bg-surface-alt p-4 lg:grid-cols-4">
            {statCards.map((card) => (
              <OverviewStatCard key={card.label} {...card} />
            ))}
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
        >
          <Tabs
            value={activeTab}
            onChange={(value) =>
              setActiveTab((value as ChildDetailTabValue | null) ?? 'progress')
            }
            orientation="vertical"
            keepMounted={false}
            className={classes.tabsRoot}
            classNames={{
              list: classes.tabsList,
              tab: classes.tab,
              tabLabel: classes.tabLabel,
              tabSection: classes.tabSection,
              panel: classes.panel,
            }}
          >
            <aside className={classes.tabsNav}>
              <div className="border-b border-outline-variant px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Navigare
                </p>
                <h2 className="mt-1 text-xl font-bold text-on-surface">
                  Detalii copil
                </h2>
              </div>
              <Tabs.List aria-label="Navigare detalii copil">
                {CHILD_DETAIL_TABS.map((tab) => (
                  <Tabs.Tab
                    key={tab.value}
                    value={tab.value}
                    rightSection={<Icon name="CaretRight" size={16} aria-hidden />}
                  >
                    {tab.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </aside>

            <section className={classes.tabsContent}>
              <div className="border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary-deep">
                  {activeTabDefinition.eyebrow}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-on-surface">
                  {activeTabDefinition.heading}
                </h2>
              </div>
              <div className="flex-1 p-4 md:p-6">
                <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-soft-sm md:p-6">
                  <Tabs.Panel value="progress">
                    <GameProgressList
                      studentId={child.id}
                      gamesWithProgress={gamesWithProgress}
                      showFilters={true}
                    />
                  </Tabs.Panel>

                  <Tabs.Panel value="games">
                    <GameProgressList
                      studentId={child.id}
                      gamesWithProgress={gamesWithProgress}
                      showFilters={false}
                    />
                  </Tabs.Panel>

                  <Tabs.Panel value="activity">
                    <ActivityFeed activities={recentActivity} maxItems={20} />
                  </Tabs.Panel>
                </div>
              </div>
            </section>
          </Tabs>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.35 }}
        >
          <ChildConsentSection
            childId={child.id}
            initialConsents={consents}
          />
        </motion.div>
      </div>
    </div>
  );
}
