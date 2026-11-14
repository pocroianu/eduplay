'use client';

import { useEffect, useMemo, useState } from 'react';
import { Select } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { Icon } from '@/shared/components/ui/Icon';
import {
  ConfirmDialog,
  DataTable,
  Pill,
  useToast,
  type DataTableColumn,
} from '@/shared/components/ui/kit';
import {
  ALL_CATEGORIES,
  CATEGORY_CONFIG,
  type Game,
  type GameCategory,
} from '@/features/games';
import { ROUTES } from '@/shared/lib/constants';
import { formatDateShort } from '@/lib/i18n/formatters';
import { FilterBar, type FilterChip } from './FilterBar';
import { RowActionMenu } from './RowActionMenu';

type StatusFilter = 'all' | 'published' | 'draft';
type CategoryFilterValue = GameCategory | '';

const filterSelectStyles = {
  input: {
    backgroundColor: 'var(--color-surface)',
    borderColor: 'var(--color-outline-variant)',
    color: 'var(--color-on-surface)',
    fontSize: 13,
    fontWeight: 600,
    minHeight: 44,
  },
} as const;

export interface AdminGamesTableProps {
  games: Game[];
}

export function AdminGamesTable({ games }: AdminGamesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [gameList, setGameList] = useState<Game[]>(games);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>('');
  const [deleteCandidate, setDeleteCandidate] = useState<Game | null>(null);

  useEffect(() => {
    setGameList(games);
  }, [games]);

  const counts = useMemo(() => {
    const total = gameList.length;
    const published = gameList.filter((g) => g.is_published).length;
    return { total, published, draft: total - published };
  }, [gameList]);

  const filteredGames = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return gameList.filter((game) => {
      if (query) {
        const matchesTitle = game.title.toLowerCase().includes(query);
        const matchesDescription = game.description?.toLowerCase().includes(query) ?? false;
        if (!matchesTitle && !matchesDescription) return false;
      }
      if (categoryFilter && game.category !== categoryFilter) return false;
      if (statusFilter === 'published' && !game.is_published) return false;
      if (statusFilter === 'draft' && game.is_published) return false;
      return true;
    });
  }, [gameList, searchQuery, statusFilter, categoryFilter]);

  const setPending = (gameId: string, isPending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (isPending) next.add(gameId);
      else next.delete(gameId);
      return next;
    });
  };

  const togglePublish = async (game: Game) => {
    const newStatus = !game.is_published;
    setPending(game.id, true);

    try {
      const response = await fetch(`/api/v1/games/${game.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: newStatus }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Nu am putut actualiza statusul jocului');
      }

      const updated = result.data as { isPublished: boolean; updatedAt: string };
      setGameList((current) =>
        current.map((item) =>
          item.id === game.id
            ? { ...item, is_published: updated.isPublished, updated_at: updated.updatedAt }
            : item,
        ),
      );

      toast({
        message: newStatus ? 'Joc publicat' : 'Joc dezactivat',
        variant: 'success',
      });
      router.refresh();
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Eroare la actualizarea jocului',
        variant: 'error',
      });
    } finally {
      setPending(game.id, false);
    }
  };

  const deleteGame = async (game: Game) => {
    setPending(game.id, true);
    try {
      const response = await fetch(`/api/v1/games/${game.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error?.message || 'Nu am putut șterge jocul');
      }

      setGameList((current) => current.filter((item) => item.id !== game.id));
      toast({ message: 'Joc șters', variant: 'success' });
      router.refresh();
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Eroare la ștergerea jocului',
        variant: 'error',
      });
    } finally {
      setPending(game.id, false);
    }
  };

  const statusChips: FilterChip<StatusFilter>[] = [
    { value: 'all', label: 'Toate', count: counts.total },
    { value: 'published', label: 'Publicate', count: counts.published },
    { value: 'draft', label: 'Draft', count: counts.draft },
  ];

  const columns: DataTableColumn<Game>[] = [
    {
      key: 'title',
      header: 'Joc',
      cell: (game) => (
        <div className="flex flex-col gap-0.5 text-left">
          <span className="text-[14px] font-bold text-on-surface leading-tight">{game.title}</span>
          {game.description ? (
            <span className="text-[12px] text-on-surface-variant leading-snug line-clamp-1 max-w-[42ch]">
              {game.description}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Categorie',
      cell: (game) => {
        if (!game.category) {
          return <span className="text-[12px] text-on-surface-variant">—</span>;
        }
        const config = CATEGORY_CONFIG[game.category];
        return (
          <Pill leading={<Icon name={config.icon} size={14} aria-hidden />}>{config.label}</Pill>
        );
      },
      hideOnMobile: false,
    },
    {
      key: 'age',
      header: 'Vârstă',
      cell: (game) => {
        const min = game.target_age_min;
        const max = game.target_age_max;
        if (min == null && max == null) {
          return <span className="text-[12px] text-on-surface-variant">—</span>;
        }
        if (min != null && max != null) {
          return <span className="text-[13px] text-on-surface-variant tabular-nums">{min}–{max} ani</span>;
        }
        const value = (min ?? max) as number;
        return <span className="text-[13px] text-on-surface-variant tabular-nums">{value} ani</span>;
      },
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (game) =>
        game.is_published ? (
          <Pill tone="lime">Publicat</Pill>
        ) : (
          <Pill tone="cream">Draft</Pill>
        ),
    },
    {
      key: 'updated',
      header: 'Actualizat',
      cell: (game) => (
        <span className="text-[13px] text-on-surface-variant tabular-nums">
          {formatDateShort(game.updated_at)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Acțiuni</span>,
      align: 'right',
      cell: (game) => {
        const pending = pendingIds.has(game.id);
        return (
          <RowActionMenu
            triggerLabel={`Acțiuni pentru ${game.title}`}
            items={[
              {
                key: 'edit',
                label: 'Editează',
                icon: 'Pencil',
                onSelect: () => router.push(ROUTES.ADMIN.CMS_ACTIVITY(game.id)),
              },
              {
                key: 'toggle',
                label: game.is_published ? 'Retrage de la publicare' : 'Publică',
                icon: game.is_published ? 'EyeSlash' : 'Eye',
                disabled: pending,
                onSelect: () => {
                  void togglePublish(game);
                },
              },
              {
                key: 'delete',
                label: 'Șterge',
                icon: 'Trash',
                destructive: true,
                disabled: pending,
                onSelect: () => setDeleteCandidate(game),
              },
            ]}
          />
        );
      },
    },
  ];

  const isFiltering = searchQuery.trim().length > 0 || statusFilter !== 'all' || categoryFilter !== '';
  const emptyTitle = isFiltering ? 'Niciun joc nu corespunde filtrelor' : 'Nu există jocuri încă';
  const emptyDescription = isFiltering
    ? 'Încearcă să modifici căutarea sau filtrele active.'
    : 'Adaugă primul joc în bibliotecă pentru a începe.';

  return (
    <div className="flex flex-col gap-5">
      <FilterBar<StatusFilter>
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Caută jocuri după titlu sau descriere"
        searchLabel="Caută jocuri"
        chips={statusChips}
        activeChip={statusFilter}
        onChipChange={setStatusFilter}
        trailing={
          <Select
            aria-label="Filtrează după categorie"
            value={categoryFilter}
            onChange={(value) =>
              setCategoryFilter((value ?? '') as CategoryFilterValue)
            }
            data={[
              { value: '', label: 'Toate categoriile' },
              ...ALL_CATEGORIES.map((cat) => ({
                value: cat,
                label: CATEGORY_CONFIG[cat].label,
              })),
            ]}
            allowDeselect={false}
            checkIconPosition="right"
            styles={filterSelectStyles}
          />
        }
      />

      <DataTable<Game>
        columns={columns}
        rows={filteredGames}
        getRowKey={(game) => game.id}
        caption="Jocuri în bibliotecă"
        className="border border-outline-variant shadow-none"
        empty={{
          icon: 'GameController',
          title: emptyTitle,
          description: emptyDescription,
        }}
      />

      <ConfirmDialog
        open={deleteCandidate !== null}
        destructive
        icon="Trash"
        confirmIcon="Trash"
        title="Ștergi jocul?"
        body={
          deleteCandidate
            ? `Jocul "${deleteCandidate.title}" va fi eliminat din bibliotecă. Acțiunea nu poate fi anulată.`
            : undefined
        }
        confirmLabel="Șterge"
        cancelLabel="Renunță"
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={() => {
          const game = deleteCandidate;
          if (!game) return;
          setDeleteCandidate(null);
          void deleteGame(game);
        }}
      />
    </div>
  );
}
