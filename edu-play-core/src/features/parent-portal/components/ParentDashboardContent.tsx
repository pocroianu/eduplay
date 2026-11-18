'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import {
  Button,
  Card,
  Pill,
  StatBlock,
  type StatBlockVariant,
  FOCUS_RING_CLASS,
} from '@/shared/components/ui/kit';
import {
  ChildSelector,
  FeedEmptyState,
  FeedTimeline,
  type EnrichedFeedItem,
} from '@/features/family-feed';
import { ROUTES } from '@/shared/lib/constants';
import type { ProgressSummary } from '../queries/types';
import { ActivityFeed } from './activity-feed';
import type { FeedItem as ActivityItemForFeed } from './activity-feed';

interface LinkedChildWithStats {
  id: string;
  name: string;
  avatarUrl: string | null;
  relationshipType: string;
  linkedAt: string;
  stats: ProgressSummary;
}

interface AggregateStats {
  totalChildren: number;
  totalGamesPlayed: number;
  averageScore: number;
  totalPlayTime: number;
}

interface ParentDashboardContentProps {
  profile: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    avatar_url?: string | null;
  };
  linkedChildren: LinkedChildWithStats[];
  recentActivity: ActivityItemForFeed[];
  aggregateStats: AggregateStats;
  feedItems?: EnrichedFeedItem[];
  /** Reserved for the upcoming "Mai multe" pagination control (EDU-33.E). */
  feedNextCursor?: string | null;
  /** Active child filter, or `null` for the cross-child feed. */
  activeChildId?: string | null;
}

function formatPlayTime(minutes: number): string {
  if (minutes === 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function buildRecommendation(
  children: LinkedChildWithStats[],
  recentActivity: ActivityItemForFeed[],
  t: TFunction,
): { headline: string; body: string } {
  if (children.length === 0) {
    return {
      headline: t('dashboard.recommendation.noChildrenHeadline'),
      body: t('dashboard.recommendation.noChildrenBody'),
    };
  }

  const inactive = children.filter((c) => !c.stats.lastActivityAt);
  if (inactive.length === children.length) {
    return {
      headline: t('dashboard.recommendation.noActivityHeadline'),
      body: t('dashboard.recommendation.noActivityBody'),
    };
  }

  if (recentActivity.length === 0) {
    return {
      headline: t('dashboard.recommendation.pauseHeadline'),
      body: t('dashboard.recommendation.pauseBody'),
    };
  }

  const lowest = [...children]
    .filter((c) => c.stats.totalGamesPlayed > 0)
    .sort((a, b) => a.stats.averageScore - b.stats.averageScore)[0];

  if (lowest && lowest.stats.averageScore < 70) {
    return {
      headline: t('dashboard.recommendation.supportHeadline', { childName: lowest.name.split(' ')[0] }),
      body: t('dashboard.recommendation.supportBody', { score: lowest.stats.averageScore }),
    };
  }

  return {
    headline: t('dashboard.recommendation.goodPaceHeadline'),
    body: t('dashboard.recommendation.goodPaceBody'),
  };
}

interface OverviewStat {
  label: string;
  value: string | number;
  icon: IconName;
  variant: StatBlockVariant;
}

export function ParentDashboardContent({
  linkedChildren,
  recentActivity,
  aggregateStats,
  feedItems = [],
  activeChildId = null,
}: ParentDashboardContentProps) {
  const { t } = useTranslation('parent');
  const reduceMotion = useReducedMotion();
  const hasChildren = linkedChildren.length > 0;
  const recommendation = buildRecommendation(linkedChildren, recentActivity, t);
  const childOptions = linkedChildren.map((c) => ({ id: c.id, name: c.name }));
  const filteredChildName =
    linkedChildren.find((c) => c.id === activeChildId)?.name ?? null;

  const statCards: OverviewStat[] = [
    {
      label: t('dashboard.stats.connectedChildren'),
      value: aggregateStats.totalChildren,
      icon: 'Users',
      variant: 'primary',
    },
    {
      label: t('dashboard.stats.gamesPlayed'),
      value: aggregateStats.totalGamesPlayed,
      icon: 'GameController',
      variant: 'primary',
    },
    {
      label: t('dashboard.stats.averageScore'),
      value: aggregateStats.averageScore > 0 ? `${aggregateStats.averageScore}%` : '—',
      icon: 'Star',
      variant: 'secondary',
    },
  ];

  return (
    <div data-testid="parent-dashboard-surface" className="bg-surface p-6 lg:p-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-4 shadow-soft-sm md:flex-row md:items-center md:justify-between"
        >
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              {t('dashboard.familyShell.eyebrow')}
            </p>
            <h1 className="text-2xl font-bold leading-tight text-on-surface md:text-3xl">
              {t('dashboard.myChildren', { defaultValue: 'Copiii mei' })}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-on-surface-variant">
              {t('dashboard.familyShell.summary')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {hasChildren && (
              <Pill tone="lime" leading={<Icon name="Users" size={14} aria-hidden />}>
                {t('dashboard.familyShell.connectedChildren')}
              </Pill>
            )}
            <Button href={ROUTES.PARENT.LINK_CHILD} variant="secondary" size="sm" className="gap-2">
              <Icon name="Plus" size={16} aria-hidden />
              {t(hasChildren ? 'dashboard.familyShell.addAnotherChild' : 'dashboard.addChild')}
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} data-testid="parent-overview-card">
              <StatBlock
                label={card.label}
                value={card.value}
                icon={card.icon}
                variant={card.variant}
                className="h-full"
              />
            </div>
          ))}

          <Link
            href={ROUTES.PARENT.LINK_CHILD}
            className={`block ${FOCUS_RING_CLASS}`}
          >
            <Card data-testid="parent-action-card" className="min-h-[146px] rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-soft-sm transition-shadow hover:shadow-soft">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
                  Acțiune rapidă
                </p>
                <h2 className="mb-5 text-xl font-bold leading-tight text-on-surface">
                  {hasChildren ? 'Adaugă încă un copil' : 'Conectează primul copil'}
                </h2>
                <div className="flex items-center gap-2 font-bold text-primary">
                  <span>Începe acum</span>
                  <Icon name="ArrowRight" size={16} aria-hidden />
                </div>
              </div>
            </Card>
          </Link>
        </div>

        {hasChildren ? (
          <div data-testid="parent-dashboard-shell" className="grid min-h-[620px] grid-cols-1 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-soft-sm xl:grid-cols-[340px_minmax(0,1fr)_340px]">
            <aside className="border-b border-outline-variant bg-surface-container-lowest xl:border-b-0 xl:border-r">
              <div className="border-b border-outline-variant px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  {t('dashboard.familyShell.connectedChildren')}
                </p>
                <h2 className="mt-1 text-xl font-bold text-on-surface">
                  {t('dashboard.familyShell.threadsTitle')}
                </h2>
              </div>
              <div className="divide-y divide-outline-variant">
                {linkedChildren.map((child) => (
                  <Link
                    key={child.id}
                    href={ROUTES.PARENT.CHILD(child.id)}
                    className={`flex items-center gap-3 px-4 py-4 transition-colors hover:bg-surface ${FOCUS_RING_CLASS}`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-deep">
                      {child.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-on-surface">
                        {child.name}
                      </p>
                      <p className="truncate text-xs text-on-surface-variant">
                        {child.stats.lastActivityAt
                          ? `${child.stats.totalGamesPlayed} jocuri jucate`
                          : 'Așteaptă prima activitate'}
                      </p>
                    </div>
                    <Icon name="CaretRight" size={16} className="text-outline" aria-hidden />
                  </Link>
                ))}
              </div>
            </aside>

            <section className="flex min-h-[560px] flex-col bg-surface">
              <div className="border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-primary-deep">
                      {t('dashboard.recentActivity')}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-on-surface">
                      {t('dashboard.familyShell.feedTitle')}
                    </h2>
                  </div>
                  <ChildSelector
                    childOptions={childOptions}
                    selectedChildId={activeChildId}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-hidden px-4 py-5 md:px-6">
                {feedItems.length === 0 ? (
                  <FeedEmptyState filteredChildName={filteredChildName} />
                ) : (
                  <FeedTimeline items={feedItems} />
                )}
              </div>
            </section>

            <aside className="border-t border-outline-variant bg-surface-container-lowest xl:border-l xl:border-t-0">
              <div className="border-b border-outline-variant px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  {t('dashboard.familyShell.detailsTitle')}
                </p>
                <h2 className="mt-1 text-xl font-bold text-on-surface">
                  {t('dashboard.familyShell.detailsTitle')}
                </h2>
              </div>
              <div className="flex flex-col gap-4 p-4">
                <Card data-testid="parent-detail-card" className="rounded-xl border border-outline-variant p-5 shadow-soft-sm">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-deep">
                      <Icon name="Lightbulb" size={16} aria-hidden />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-primary-deep">
                      {t('dashboard.recommendation.label')}
                    </p>
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-on-surface">
                    {recommendation.headline}
                  </h3>
                  <p className="text-sm leading-6 text-on-surface-variant">
                    {recommendation.body}
                  </p>
                </Card>

                <Card data-testid="parent-detail-card" className="rounded-xl border border-outline-variant p-5 shadow-soft-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Această săptămână
                      </p>
                      <h3 className="text-lg font-bold text-on-surface">
                        Rezumat de joc
                      </h3>
                    </div>
                    <Icon name="ChartLineUp" size={20} className="text-primary" aria-hidden />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-outline-variant bg-surface px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                        Timp total
                      </p>
                      <p className="mt-1 text-xl font-bold text-on-surface">
                        {formatPlayTime(aggregateStats.totalPlayTime)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-outline-variant bg-surface px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                        Activități
                      </p>
                      <p className="mt-1 text-xl font-bold text-on-surface">
                        {recentActivity.length}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card data-testid="parent-detail-card" className="rounded-xl border border-outline-variant p-5 shadow-soft-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <Icon name="SquaresFour" size={20} className="text-primary" aria-hidden />
                    <h3 className="text-lg font-bold text-on-surface">
                      Activitate recentă
                    </h3>
                  </div>
                  <ActivityFeed activities={recentActivity} maxItems={5} />
                </Card>
              </div>
            </aside>
          </div>
        ) : (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.35 }}
          >
            <Card padding="none" className="overflow-hidden rounded-xl border border-outline-variant shadow-soft-sm">
              <div className="grid items-stretch md:grid-cols-[minmax(0,1fr)_320px]">
                <div className="px-6 py-8 md:px-8">
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary-deep">
                    Niciun copil conectat
                  </p>
                  <h2 className="mb-3 text-2xl font-bold leading-tight text-on-surface">
                    Conectează primul tău copil pentru a-i vedea progresul
                  </h2>
                  <p className="mb-6 max-w-md text-base text-on-surface-variant">
                    Folosește codul de invitație primit de la profesorul copilului. În câteva secunde
                    vei vedea jocurile completate, scorurile și recomandări utile.
                  </p>
                  <Button href={ROUTES.PARENT.LINK_CHILD} className="gap-2">
                    <Icon name="Link" size={16} aria-hidden />
                    Conectează cu cod
                  </Button>
                </div>
                <div className="flex flex-col justify-center gap-3 border-t border-outline-variant bg-surface p-6 md:border-l md:border-t-0">
                  <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-soft-sm">
                    <p className="text-sm font-bold text-on-surface">
                      Pasul 1
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Cere profesorului codul clasei.
                    </p>
                  </div>
                  <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-soft-sm">
                    <p className="text-sm font-bold text-on-surface">
                      Pasul 2
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Introdu codul și relația cu copilul.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
