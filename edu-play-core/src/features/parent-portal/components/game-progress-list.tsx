'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@/shared/components/ui/Icon';
import {
  Card,
  DuoProgress,
  EmptyState,
  FilterSelect,
  type FilterSelectOption,
} from '@/shared/components/ui/kit';
import { staggerContainer, staggerItem } from '@/config/animations';
import { getCategoryConfig, type GameWithProgress } from '@/features/games';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterValue = 'all' | 'completed' | 'in_progress' | 'not_started';
type SortValue = 'recent' | 'score_asc' | 'score_desc' | 'time_played';

interface GameProgressListProps {
  studentId: string;
  gamesWithProgress: GameWithProgress[];
  /** Whether to show filter and sort dropdowns. Default: false. */
  showFilters?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: Array<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'Toate' },
  { value: 'completed', label: 'Completate' },
  { value: 'in_progress', label: 'În progres' },
  { value: 'not_started', label: 'Neîncepute' },
];

const SORT_OPTIONS: Array<{ value: SortValue; label: string }> = [
  { value: 'recent', label: 'Cel mai recent' },
  { value: 'score_desc', label: 'Scor (descrescător)' },
  { value: 'score_asc', label: 'Scor (crescător)' },
  { value: 'time_played', label: 'Timp jucat' },
];

const FILTER_SELECT_OPTIONS: FilterSelectOption[] = FILTER_OPTIONS;
const SORT_SELECT_OPTIONS: FilterSelectOption[] = SORT_OPTIONS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGameStatus(game: GameWithProgress): FilterValue {
  if (!game.progress) return 'not_started';
  const status = game.progress.status;
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'in_progress';
  return 'not_started';
}

function getStatusLabel(status: FilterValue): string {
  switch (status) {
    case 'completed':
      return 'Completat';
    case 'in_progress':
      return 'În progres';
    case 'not_started':
      return 'Neînceput';
    default:
      return 'Toate';
  }
}

function getStatusBadgeClasses(status: FilterValue): string {
  switch (status) {
    case 'completed':
      return 'bg-primary-soft text-primary-deep';
    case 'in_progress':
      return 'bg-primary-container text-on-primary-container';
    case 'not_started':
      return 'bg-surface-container text-on-surface';
    default:
      return 'bg-surface-container text-on-surface';
  }
}

function getProgressPercent(game: GameWithProgress): number {
  if (!game.progress) return 0;
  if (game.progress.status === 'completed') return 100;
  if (game.progress.status === 'in_progress') {
    return game.progress.score ?? 50;
  }
  return 0;
}

function formatPlayTime(seconds: number | null): string {
  if (!seconds || seconds === 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function filterGames(
  games: GameWithProgress[],
  filter: FilterValue
): GameWithProgress[] {
  if (filter === 'all') return games;
  return games.filter((game) => getGameStatus(game) === filter);
}

function sortGames(
  games: GameWithProgress[],
  sort: SortValue
): GameWithProgress[] {
  const sorted = [...games];

  switch (sort) {
    case 'recent':
      sorted.sort((a, b) => {
        const aDate = a.progress?.last_played_at ?? '';
        const bDate = b.progress?.last_played_at ?? '';
        return bDate.localeCompare(aDate);
      });
      break;
    case 'score_asc':
      sorted.sort((a, b) => (a.progress?.score ?? 0) - (b.progress?.score ?? 0));
      break;
    case 'score_desc':
      sorted.sort((a, b) => (b.progress?.score ?? 0) - (a.progress?.score ?? 0));
      break;
    case 'time_played':
      sorted.sort(
        (a, b) => (b.progress?.time_spent ?? 0) - (a.progress?.time_spent ?? 0)
      );
      break;
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface GameCardProps {
  game: GameWithProgress;
}

function GameProgressCard({ game }: GameCardProps) {
  const categoryConfig = getCategoryConfig(game.category);
  const status = getGameStatus(game);
  const hasPlayed = game.progress && game.progress.status !== 'not_started';
  const progressPercent = getProgressPercent(game);

  return (
    <motion.div
      variants={staggerItem}
      whileHover="hover"
    >
      <Card className="overflow-hidden rounded-xl p-0">
      {/* Colored header with Duo subject icon */}
      <div
        className="h-[72px] flex items-center justify-center relative"
        style={{ backgroundColor: categoryConfig.bgColor }}
      >
        <Icon name={categoryConfig.icon} size={32} weight="fill" style={{ color: categoryConfig.color }} aria-hidden />

        {/* Status badge */}
        <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full ${getStatusBadgeClasses(status)}`}>
          {getStatusLabel(status)}
        </span>
      </div>

      <div className="p-4">
        {/* Title */}
        <p className="font-bold text-sm truncate mb-2 text-on-surface">
          {game.title}
        </p>

        {/* Category badge + Difficulty stars */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs px-2 py-0.5 rounded bg-opacity-20" style={{ backgroundColor: categoryConfig.bgColor }}>
            {categoryConfig.label}
          </span>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Icon
                key={i}
                name="Star"
                size={10}
                weight={i < (game.difficulty_level || 1) ? 'fill' : 'regular'}
                style={{ color: i < (game.difficulty_level || 1) ? 'var(--color-secondary-container)' : 'var(--color-surface-container)' }}
              />
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-on-surface-variant">Progres</span>
            <span className="text-xs font-semibold text-on-surface-variant">{progressPercent}%</span>
          </div>
          <DuoProgress value={progressPercent} height={8} />
        </div>

        {/* Score and stats */}
        {hasPlayed ? (
          <div>
            {/* Score */}
            {game.progress?.score !== null && game.progress?.score !== undefined && (
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1">
                  <Icon name="Trophy" size={14} className="text-gold" />
                  <span className="text-xs text-on-surface-variant">Scor</span>
                </div>
                <span className="font-bold text-sm" style={{ color: categoryConfig.color }}>
                  {game.progress.score}%
                </span>
              </div>
            )}

            {/* Time played + Attempts */}
            <div className="flex justify-between text-xs text-on-surface-variant">
              {game.progress?.time_spent !== null &&
                game.progress?.time_spent !== undefined && (
                  <div className="flex items-center gap-1">
                    <Icon name="Clock" size={12} />
                    <span>{formatPlayTime(game.progress.time_spent)}</span>
                  </div>
                )}
              {game.progress?.attempts !== null &&
                game.progress?.attempts !== undefined &&
                game.progress.attempts > 0 && (
                  <span>
                    {game.progress.attempts}{' '}
                    {game.progress.attempts === 1 ? 'încercare' : 'încercări'}
                  </span>
                )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-outline text-center py-2">
            Încă nu a jucat acest joc
          </p>
        )}
      </div>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GameProgressList({
  studentId,
  gamesWithProgress,
  showFilters = false,
}: GameProgressListProps) {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [sort, setSort] = useState<SortValue>('recent');

  const processedGames = useMemo(() => {
    const filtered = filterGames(gamesWithProgress, filter);
    return sortGames(filtered, sort);
  }, [gamesWithProgress, filter, sort]);

  // Empty state
  if (gamesWithProgress.length === 0) {
    return (
      <Card className="rounded-xl p-0">
        <EmptyState
          icon="GameController"
          title="Nu există jocuri disponibile"
          description="Jocurile vor apărea aici când copilul va începe să joace."
        />
      </Card>
    );
  }

  return (
    <div data-student-id={studentId}>
      {/* Filters and Sort Controls */}
      {showFilters && (
        <div className="flex gap-3 mb-5 flex-wrap items-center">
          {/* Filter dropdown */}
          <FilterSelect
            label="Filtru"
            icon="FunnelSimple"
            value={filter}
            onChange={(value) => setFilter(value as FilterValue)}
            className="min-w-44"
            options={FILTER_SELECT_OPTIONS}
            radius="md"
            width={176}
          />

          {/* Sort dropdown */}
          <FilterSelect
            label="Sortare"
            icon="ArrowsDownUp"
            value={sort}
            onChange={(value) => setSort(value as SortValue)}
            className="min-w-52"
            options={SORT_SELECT_OPTIONS}
            radius="md"
            width={208}
          />

          {/* Results count */}
          <span className="text-sm text-on-surface-variant ml-auto">
            {processedGames.length} din {gamesWithProgress.length} jocuri
          </span>
        </div>
      )}

      {/* Filtered empty state */}
      {processedGames.length === 0 ? (
        <Card className="rounded-xl p-0">
          <EmptyState
            icon="FunnelSimple"
            title="Niciun joc găsit"
            description="Încearcă să schimbi filtrele."
          />
        </Card>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {processedGames.map((game) => (
            <GameProgressCard key={game.id} game={game} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
