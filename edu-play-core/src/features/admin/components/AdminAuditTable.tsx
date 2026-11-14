'use client';

import { useEffect, useMemo, useState } from 'react';
import { Select, TextInput } from '@mantine/core';
import {
  Button,
  DataTable,
  Pill,
  useToast,
  type DataTableColumn,
} from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import { formatDateTime, formatRelativeTime } from '@/lib/i18n/formatters';
import type { AdminAuditEntry } from '@/features/admin/api/schemas';
import { ROUTES } from '@/shared/lib/constants';
import { FilterBar } from './FilterBar';

const KNOWN_ACTIONS = [
  'user_suspended',
  'user_reactivated',
  'student_pin_reset',
  'password_reset_requested',
  'user_deletion_initiated',
  'flag_created',
  'flag_updated',
  'flag_deleted',
] as const;

type KnownAction = (typeof KNOWN_ACTIONS)[number];

const ACTION_LABEL: Record<KnownAction, string> = {
  user_suspended: 'Suspendare cont',
  user_reactivated: 'Reactivare cont',
  student_pin_reset: 'Resetare PIN elev',
  password_reset_requested: 'Cerere resetare parolă',
  user_deletion_initiated: 'Inițiere ștergere',
  flag_created: 'Creare flag',
  flag_updated: 'Actualizare flag',
  flag_deleted: 'Ștergere flag',
};

const RESOURCE_LABEL: Record<string, string> = {
  profiles: 'Cont utilizator',
  feature_flags: 'Feature flag',
  deletion_requests: 'Cerere ștergere',
};

const VISIBILITY_LABEL: Record<string, { label: string; tone: 'lime' | 'sun' | 'cream' }> = {
  platform: { label: 'Platformă', tone: 'lime' },
  family: { label: 'Familie', tone: 'sun' },
  internal: { label: 'Intern', tone: 'cream' },
};

function formatActionLabel(action: string | null): string {
  if (!action) return '—';
  if ((KNOWN_ACTIONS as readonly string[]).includes(action)) {
    return ACTION_LABEL[action as KnownAction];
  }
  // Fallback: humanise snake_case
  return action
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatResourceLabel(resourceType: string | null): string {
  if (!resourceType) return '—';
  return RESOURCE_LABEL[resourceType] ?? resourceType;
}

function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export interface AdminAuditTableProps {
  initialEntries: AdminAuditEntry[];
  initialNextCursor: string | null;
  actorMap: Record<string, string>;
}

interface QueryFilters {
  action: string;
  resourceType: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: QueryFilters = {
  action: '',
  resourceType: '',
  from: '',
  to: '',
};

const queryFilterStyles = {
  label: {
    color: 'var(--color-on-surface-variant)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.16em',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  input: {
    backgroundColor: 'var(--color-surface-container-lowest)',
    borderColor: 'var(--color-outline-variant)',
    color: 'var(--color-on-surface)',
    fontSize: 13,
    fontWeight: 600,
    minHeight: 44,
  },
} as const;

export function AdminAuditTable({
  initialEntries,
  initialNextCursor,
  actorMap,
}: AdminAuditTableProps) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<AdminAuditEntry[]>(initialEntries);
  const [actors, setActors] = useState<Record<string, string>>(actorMap);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<QueryFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<QueryFilters>(EMPTY_FILTERS);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setEntries(initialEntries);
    setActors(actorMap);
    setNextCursor(initialNextCursor);
  }, [initialEntries, initialNextCursor, actorMap]);

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => {
      const action = (entry.action ?? '').toLowerCase();
      const actionLabel = formatActionLabel(entry.action).toLowerCase();
      const resourceLabel = formatResourceLabel(entry.resourceType).toLowerCase();
      const actorName = entry.actorId ? (actors[entry.actorId] ?? '').toLowerCase() : '';
      const resourceId = (entry.resourceId ?? '').toLowerCase();
      return (
        action.includes(query) ||
        actionLabel.includes(query) ||
        resourceLabel.includes(query) ||
        actorName.includes(query) ||
        resourceId.includes(query)
      );
    });
  }, [entries, searchQuery, actors]);

  const buildQueryString = (filters: QueryFilters): string => {
    const params = new URLSearchParams();
    if (filters.action) params.set('action', filters.action);
    if (filters.resourceType) params.set('resourceType', filters.resourceType);
    if (filters.from) {
      const fromDate = new Date(filters.from);
      if (!Number.isNaN(fromDate.getTime())) params.set('from', fromDate.toISOString());
    }
    if (filters.to) {
      const toDate = new Date(filters.to);
      if (!Number.isNaN(toDate.getTime())) {
        // The HTML `<input type="date">` resolves to midnight local time.
        // The API filter is `changed_at <= to`, so without bumping to the
        // end-of-day we'd silently drop every same-day record.
        toDate.setHours(23, 59, 59, 999);
        params.set('to', toDate.toISOString());
      }
    }
    return params.toString();
  };

  const applyFilters = async () => {
    setRefreshing(true);
    try {
      const qs = buildQueryString(draftFilters);
      const url = qs ? `/api/v1/admin/audit?${qs}` : '/api/v1/admin/audit';
      const response = await fetch(url);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Nu am putut aplica filtrele');
      }
      const newEntries = result.data as AdminAuditEntry[];
      setEntries(newEntries);
      setNextCursor((result.meta?.nextCursor as string | null) ?? null);
      setAppliedFilters(draftFilters);
      // Actor map refresh: the API doesn't enrich names, so any new actorId
      // will fall back to the short slug until the page is server-rendered
      // again. That's acceptable for interactive filtering — refreshing the
      // route would re-enrich names.
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Eroare la filtrare',
        variant: 'error',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const resetFilters = async () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSearchQuery('');
    setRefreshing(true);
    try {
      const response = await fetch('/api/v1/admin/audit');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Eroare');
      setEntries(result.data as AdminAuditEntry[]);
      setNextCursor((result.meta?.nextCursor as string | null) ?? null);
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Eroare la reîncărcare',
        variant: 'error',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ cursor: nextCursor });
      const filterQs = buildQueryString(appliedFilters);
      if (filterQs) {
        const filterParams = new URLSearchParams(filterQs);
        filterParams.forEach((value, key) => params.set(key, value));
      }
      const response = await fetch(`/api/v1/admin/audit?${params.toString()}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Nu am putut încărca');
      }
      const newEntries = result.data as AdminAuditEntry[];
      setEntries((current) => [...current, ...newEntries]);
      setNextCursor((result.meta?.nextCursor as string | null) ?? null);
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Eroare la încărcare',
        variant: 'error',
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const exportHref = useMemo(() => {
    const qs = buildQueryString(appliedFilters);
    return qs ? `${ROUTES.ADMIN.AUDIT_EXPORT}?${qs}` : ROUTES.ADMIN.AUDIT_EXPORT;
  }, [appliedFilters]);

  const columns: DataTableColumn<AdminAuditEntry>[] = [
    {
      key: 'when',
      header: 'Când',
      cell: (entry) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-bold text-on-surface tabular-nums">
            {formatRelativeTime(entry.createdAt)}
          </span>
          <span className="text-[12px] text-on-surface-variant tabular-nums">
            {formatDateTime(entry.createdAt)}
          </span>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Autor',
      cell: (entry) => {
        if (!entry.actorId) {
          return (
            <span className="text-[12px] text-on-surface-variant italic">Sistem</span>
          );
        }
        const name = actors[entry.actorId];
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-bold text-on-surface leading-tight">
              {name ?? 'Utilizator necunoscut'}
            </span>
            <span className="text-[11px] font-mono text-on-surface-variant">
              {shortId(entry.actorId)}
            </span>
          </div>
        );
      },
      hideOnMobile: false,
    },
    {
      key: 'action',
      header: 'Acțiune',
      cell: (entry) => (
        <span className="text-[14px] font-semibold text-on-surface">
          {formatActionLabel(entry.action)}
        </span>
      ),
    },
    {
      key: 'resource',
      header: 'Resursă',
      cell: (entry) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-on-surface">
            {formatResourceLabel(entry.resourceType)}
          </span>
          {entry.resourceId ? (
            <span className="text-[11px] font-mono text-on-surface-variant">
              {shortId(entry.resourceId)}
            </span>
          ) : null}
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: 'visibility',
      header: 'Vizibilitate',
      cell: (entry) => {
        const config = entry.visibility ? VISIBILITY_LABEL[entry.visibility] : null;
        if (!config) {
          return <span className="text-[12px] text-on-surface-variant">—</span>;
        }
        return <Pill tone={config.tone}>{config.label}</Pill>;
      },
      hideOnMobile: true,
    },
  ];

  const isFiltering =
    searchQuery.trim().length > 0 ||
    Boolean(appliedFilters.action) ||
    Boolean(appliedFilters.resourceType) ||
    Boolean(appliedFilters.from) ||
    Boolean(appliedFilters.to);

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Caută în acțiune, autor sau resursă"
        searchLabel="Caută în jurnalul de audit"
        trailing={
          <Button href={exportHref} variant="secondary" size="sm">
            <Icon name="ArrowSquareOut" size="sm" aria-hidden />
            Export CSV
          </Button>
        }
      />

      <div className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput
          type="date"
          label="De la"
          value={draftFilters.from}
          onChange={(e) => setDraftFilters((f) => ({ ...f, from: e.target.value }))}
          styles={queryFilterStyles}
        />
        <TextInput
          type="date"
          label="Până la"
          value={draftFilters.to}
          onChange={(e) => setDraftFilters((f) => ({ ...f, to: e.target.value }))}
          styles={queryFilterStyles}
        />
        <Select
          label="Acțiune"
          value={draftFilters.action}
          onChange={(value) =>
            setDraftFilters((f) => ({ ...f, action: value ?? '' }))
          }
          data={[
            { value: '', label: 'Toate acțiunile' },
            ...KNOWN_ACTIONS.map((action) => ({
              value: action,
              label: ACTION_LABEL[action],
            })),
          ]}
          allowDeselect={false}
          checkIconPosition="right"
          styles={queryFilterStyles}
        />
        <Select
          label="Resursă"
          value={draftFilters.resourceType}
          onChange={(value) =>
            setDraftFilters((f) => ({ ...f, resourceType: value ?? '' }))
          }
          data={[
            { value: '', label: 'Toate resursele' },
            ...Object.entries(RESOURCE_LABEL).map(([key, label]) => ({
              value: key,
              label,
            })),
          ]}
          allowDeselect={false}
          checkIconPosition="right"
          styles={queryFilterStyles}
        />
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              void applyFilters();
            }}
            disabled={refreshing}
          >
            {refreshing ? 'Se aplică...' : 'Aplică filtrele'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void resetFilters();
            }}
            disabled={refreshing}
          >
            Reset
          </Button>
        </div>
      </div>

      <DataTable<AdminAuditEntry>
        columns={columns}
        rows={filteredEntries}
        getRowKey={(entry) => entry.id}
        caption="Jurnal de audit"
        empty={{
          icon: 'ClipboardText',
          title: isFiltering
            ? 'Niciun eveniment nu corespunde filtrelor'
            : 'Jurnalul de audit este gol',
          description: isFiltering
            ? 'Încearcă să modifici intervalul, acțiunea sau să resetezi filtrele.'
            : 'Evenimentele de audit vor apărea aici imediat ce un administrator efectuează acțiuni semnificative.',
        }}
      />

      {nextCursor ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void loadMore();
            }}
            disabled={loadingMore}
          >
            {loadingMore ? 'Se încarcă...' : 'Încarcă următorii'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
