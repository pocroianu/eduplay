'use client';

import { useMemo, useState } from 'react';
import { Checkbox as MantineCheckbox } from '@mantine/core';
import { useRouter } from 'next/navigation';
import type {
  ActivityRow,
  ActivityTypeRow,
} from '@/features/api';
import { formatDateShort } from '@/lib/i18n/formatters';
import {
  Button,
  ConfirmDialog,
  DataTable,
  FilterSelect,
  Pill,
  useToast,
  type DataTableColumn,
  type FilterSelectOption,
} from '@/shared/components/ui/kit';
import { ROUTES } from '@/shared/lib/constants';
import type { PaginationMeta } from '@/lib/api';
import { FilterBar, type FilterChip } from './FilterBar';
import { RowActionMenu } from './RowActionMenu';
import { ActivityStatusBadge, getActivityStatus } from './ActivityStatusBadge';

type StatusFilter = 'all' | 'draft' | 'in_review' | 'published' | 'archived';

interface ActivityFilters {
  status: StatusFilter;
  typeId: string;
  subject: string;
  search: string;
  page: number;
}

export interface AdminActivitiesTableProps {
  initialActivities: ActivityRow[];
  activityTypes: ActivityTypeRow[];
  initialMeta: PaginationMeta;
  subjectOptions?: string[];
}

const SUBJECT_LABELS: Record<string, string> = {
  math: 'Matematică',
  romana: 'Română',
  română: 'Română',
  stiinte: 'Științe',
  'științe': 'Științe',
  arte: 'Arte',
  muzica: 'Muzică',
  muzică: 'Muzică',
  sport: 'Sport',
};

function subjectLabel(subject: string | null | undefined): string {
  if (!subject) return '—';
  return SUBJECT_LABELS[subject] ?? subject;
}

function getTypeLabel(activityTypes: ActivityTypeRow[], typeId: string): string {
  return activityTypes.find((type) => type.typeId === typeId)?.displayName ?? typeId;
}

function buildActivitiesUrl(filters: ActivityFilters): string {
  const params = new URLSearchParams();
  params.set('perPage', '20');
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.typeId) params.set('typeId', filters.typeId);
  if (filters.subject) params.set('subject', filters.subject);
  if (filters.search.trim()) params.set('search', filters.search.trim());
  return `/api/v1/activities?${params.toString()}`;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

function readPaginationMeta(
  meta: { pagination?: PaginationMeta } | PaginationMeta | undefined,
  fallback: PaginationMeta,
): PaginationMeta {
  if (!meta) return fallback;
  if ('pagination' in meta && meta.pagination) return meta.pagination;
  return meta as PaginationMeta;
}

export function AdminActivitiesTable({
  initialActivities,
  activityTypes,
  initialMeta,
  subjectOptions: providedSubjectOptions,
}: AdminActivitiesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [activities, setActivities] = useState(initialActivities);
  const [meta, setMeta] = useState(initialMeta);
  const [filters, setFilters] = useState<ActivityFilters>({
    status: 'all',
    typeId: '',
    subject: '',
    search: '',
    page: initialMeta.page,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [archiveCandidate, setArchiveCandidate] = useState<ActivityRow | null>(null);

  const subjectOptions = useMemo(() => {
    const subjects = new Set<string>();
    for (const subject of providedSubjectOptions ?? []) {
      if (subject) subjects.add(subject);
    }
    if (!providedSubjectOptions) {
      for (const activity of initialActivities) {
        if (activity.subject) subjects.add(activity.subject);
      }
    }
    return Array.from(subjects).sort((a, b) =>
      subjectLabel(a).localeCompare(subjectLabel(b), 'ro-RO'),
    );
  }, [initialActivities, providedSubjectOptions]);

  const typeFilterOptions = useMemo<FilterSelectOption[]>(
    () => [
      { value: '', label: 'Toate tipurile' },
      ...activityTypes.map((type) => ({
        value: type.typeId,
        label: type.displayName,
      })),
    ],
    [activityTypes],
  );

  const subjectFilterOptions = useMemo<FilterSelectOption[]>(
    () => [
      { value: '', label: 'Toate materiile' },
      ...subjectOptions.map((subject) => ({
        value: subject,
        label: subjectLabel(subject),
      })),
    ],
    [subjectOptions],
  );

  const selectedDrafts = activities.filter(
    (activity) => selectedIds.has(activity.id) && getActivityStatus(activity) === 'draft',
  );

  const setPending = (activityId: string, isPending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (isPending) next.add(activityId);
      else next.delete(activityId);
      return next;
    });
  };

  const loadActivities = async (nextFilters: ActivityFilters) => {
    setLoading(true);
    setFilters(nextFilters);
    try {
      const response = await fetch(buildActivitiesUrl(nextFilters));
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Nu am putut încărca activitățile'));
      }
      const body = await response.json();
      setActivities(body.data ?? []);
      setMeta(readPaginationMeta(body.meta, initialMeta));
      setSelectedIds(new Set());
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Eroare la încărcarea activităților',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateFilters = (patch: Partial<ActivityFilters>) => {
    const nextFilters = { ...filters, page: 1, ...patch };
    void loadActivities(nextFilters);
  };

  const publishOne = async (activity: ActivityRow): Promise<ActivityRow> => {
    setPending(activity.id, true);
    try {
      const response = await fetch(`/api/v1/activities/${activity.id}/publish`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Nu am putut publica activitatea'));
      }
      const body = await response.json();
      return body.data.activity as ActivityRow;
    } finally {
      setPending(activity.id, false);
    }
  };

  const bulkPublish = async () => {
    if (selectedDrafts.length === 0) return;

    const results = await Promise.allSettled(selectedDrafts.map(publishOne));
    const publishedCount = results.filter(
      (result): result is PromiseFulfilledResult<ActivityRow> =>
        result.status === 'fulfilled',
    ).length;
    const failed = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    setSelectedIds(new Set());
    await loadActivities(filters);
    router.refresh();

    if (failed.length === 0) {
      toast({
        message: 'Activități publicate',
        description: `${publishedCount} activități sunt acum vizibile în fluxul de conținut.`,
        variant: 'success',
      });
      return;
    }

    const firstError = failed[0]?.reason;
    if (publishedCount > 0) {
      toast({
        message: 'Publicare parțială',
        description: `${publishedCount} activități au fost publicate. ${failed.length} au rămas nepublicate.`,
        variant: 'error',
      });
      return;
    }

    toast({
      message: firstError instanceof Error ? firstError.message : 'Eroare la publicare',
      variant: 'error',
    });
  };

  const archiveActivity = async (activity: ActivityRow) => {
    setPending(activity.id, true);
    try {
      const response = await fetch(`/api/v1/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived', isPublished: false }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Nu am putut arhiva activitatea'));
      }
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(activity.id);
        return next;
      });
      await loadActivities(filters);
      toast({ message: 'Activitate arhivată', variant: 'success' });
      router.refresh();
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Eroare la arhivare',
        variant: 'error',
      });
    } finally {
      setPending(activity.id, false);
    }
  };

  const toggleSelected = (activityId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(activityId);
      else next.delete(activityId);
      return next;
    });
  };

  const statusChips: FilterChip<StatusFilter>[] = [
    { value: 'all', label: 'Toate' },
    { value: 'draft', label: 'Ciornă' },
    { value: 'in_review', label: 'În revizuire' },
    { value: 'published', label: 'Publicate' },
    { value: 'archived', label: 'Arhivate' },
  ];

  const columns: DataTableColumn<ActivityRow>[] = [
    {
      key: 'select',
      header: <span className="sr-only">Selectare</span>,
      cell: (activity) => {
        const status = getActivityStatus(activity);
        const disabled = status !== 'draft' || pendingIds.has(activity.id);
        return (
          <MantineCheckbox
            aria-label={`Selectează ${activity.title}`}
            checked={selectedIds.has(activity.id)}
            disabled={disabled}
            onChange={(event) => toggleSelected(activity.id, event.target.checked)}
            color="purple"
            radius="sm"
            size="md"
            classNames={{ root: 'min-h-11 min-w-11' }}
            styles={{
              root: {
                alignItems: 'center',
                display: 'flex',
                justifyContent: 'center',
              },
              body: { alignItems: 'center', justifyContent: 'center' },
              input: {
                backgroundColor: 'var(--color-surface-container-lowest)',
                borderColor: 'var(--color-outline-variant)',
                cursor: disabled ? 'not-allowed' : 'pointer',
              },
            }}
          />
        );
      },
      hideOnMobile: true,
    },
    {
      key: 'title',
      header: 'Activitate',
      cell: (activity) => (
        <div className="flex flex-col gap-0.5 text-left">
          <span className="text-[14px] font-bold leading-tight text-on-surface">
            {activity.title}
          </span>
          {activity.description ? (
            <span className="line-clamp-1 max-w-[44ch] text-[12px] leading-snug text-on-surface-variant">
              {activity.description}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tip',
      cell: (activity) => (
        <span className="text-[13px] font-semibold text-on-surface-variant">
          {getTypeLabel(activityTypes, activity.template)}
        </span>
      ),
    },
    {
      key: 'subject',
      header: 'Materie',
      cell: (activity) =>
        activity.subject ? (
          <Pill tone="sky">{subjectLabel(activity.subject)}</Pill>
        ) : (
          <span className="text-[12px] text-on-surface-variant">—</span>
        ),
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: 'Stare',
      cell: (activity) => <ActivityStatusBadge activity={activity} />,
    },
    {
      key: 'updated',
      header: 'Actualizat',
      cell: (activity) => (
        <span className="text-[13px] tabular-nums text-on-surface-variant">
          {activity.updatedAt ? formatDateShort(activity.updatedAt) : '—'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Acțiuni</span>,
      align: 'right',
      cell: (activity) => (
        <RowActionMenu
          triggerLabel={`Acțiuni pentru ${activity.title}`}
          items={[
            {
              key: 'edit',
              label: 'Deschide editorul',
              icon: 'Pencil',
              onSelect: () => router.push(ROUTES.ADMIN.CMS_ACTIVITY(activity.id)),
            },
            {
              key: 'publish',
              label: 'Publică',
              icon: 'Eye',
              disabled: getActivityStatus(activity) !== 'draft' || pendingIds.has(activity.id),
              onSelect: () => {
                void bulkPublishSingle(activity);
              },
            },
            {
              key: 'archive',
              label: 'Arhivează',
              icon: 'Trash',
              destructive: true,
              disabled: getActivityStatus(activity) === 'archived' || pendingIds.has(activity.id),
              onSelect: () => setArchiveCandidate(activity),
            },
          ]}
        />
      ),
    },
  ];

  const bulkPublishSingle = async (activity: ActivityRow) => {
    try {
      await publishOne(activity);
      await loadActivities(filters);
      toast({ message: 'Activitate publicată', variant: 'success' });
      router.refresh();
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Eroare la publicare',
        variant: 'error',
      });
    }
  };

  const hasPrevious = meta.page > 1;
  const hasNext = meta.page < meta.totalPages;

  return (
    <div className="flex flex-col gap-5">
      <FilterBar<StatusFilter>
        searchValue={filters.search}
        onSearchChange={(value) => updateFilters({ search: value })}
        searchPlaceholder="Caută activități după titlu"
        searchLabel="Caută activități"
        chips={statusChips}
        activeChip={filters.status}
        onChipChange={(status) => updateFilters({ status })}
        trailing={
          <>
            <FilterSelect
              ariaLabel="Filtrează după tip"
              value={filters.typeId}
              onChange={(typeId) => updateFilters({ typeId })}
              options={typeFilterOptions}
              size="sm"
              radius="md"
              icon="PuzzlePiece"
              width={190}
            />
            <FilterSelect
              ariaLabel="Filtrează după materie"
              value={filters.subject}
              onChange={(subject) => updateFilters({ subject })}
              options={subjectFilterOptions}
              size="sm"
              radius="md"
              icon="BookOpen"
              width={180}
            />
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="text-[13px] font-semibold text-on-surface-variant">
          {selectedDrafts.length > 0
            ? `${selectedDrafts.length} ciorne selectate`
            : `${meta.total} activități găsite`}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={selectedDrafts.length === 0}
          onClick={() => {
            void bulkPublish();
          }}
        >
          Publică selectate
        </Button>
      </div>

      <DataTable<ActivityRow>
        columns={columns}
        rows={activities}
        getRowKey={(activity) => activity.id}
        caption="Activități CMS"
        loading={loading}
        className="border border-outline-variant shadow-none"
        empty={{
          icon: 'ListChecks',
          title: 'Nu există activități pentru filtrele curente',
          description: 'Schimbă filtrul, tipul sau termenul căutat.',
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-[13px] text-on-surface-variant">
        <span>
          Pagina {meta.page} din {Math.max(meta.totalPages, 1)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hasPrevious || loading}
            onClick={() => {
              void loadActivities({ ...filters, page: filters.page - 1 });
            }}
          >
            Înapoi
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hasNext || loading}
            onClick={() => {
              void loadActivities({ ...filters, page: filters.page + 1 });
            }}
          >
            Pagina următoare
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={archiveCandidate !== null}
        destructive
        icon="Trash"
        title="Arhivezi activitatea?"
        body={
          archiveCandidate
            ? `Activitatea "${archiveCandidate.title}" va fi retrasă din fluxul activ. O poți vedea în filtrul Arhivate.`
            : undefined
        }
        confirmLabel="Arhivează"
        cancelLabel="Renunță"
        onCancel={() => setArchiveCandidate(null)}
        onConfirm={() => {
          const activity = archiveCandidate;
          if (!activity) return;
          setArchiveCandidate(null);
          void archiveActivity(activity);
        }}
      />
    </div>
  );
}
