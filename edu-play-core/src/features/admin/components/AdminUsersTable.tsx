'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@mantine/core';
import { useRouter } from 'next/navigation';
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
import { Icon } from '@/shared/components/ui/Icon';
import { formatDateShort } from '@/lib/i18n/formatters';
import {
  ADMIN_USER_ROLES,
  type AdminUserSummary,
  type ResetCredentialsResponse,
} from '@/features/admin/api/schemas';
import { FilterBar, type FilterChip } from './FilterBar';
import { RowActionMenu } from './RowActionMenu';

type StatusFilter = 'all' | 'active' | 'suspended';
type RoleFilter = (typeof ADMIN_USER_ROLES)[number] | '';
type UserConfirmAction =
  | { kind: 'reset-credentials'; user: AdminUserSummary }
  | { kind: 'initiate-deletion'; user: AdminUserSummary };

const ROLE_LABEL: Record<(typeof ADMIN_USER_ROLES)[number], string> = {
  teacher: 'Profesor',
  parent: 'Părinte',
  student: 'Elev',
  admin: 'Administrator',
};

const ROLE_FILTER_OPTIONS: FilterSelectOption[] = [
  { value: '', label: 'Toate rolurile' },
  ...ADMIN_USER_ROLES.map((role) => ({
    value: role,
    label: ROLE_LABEL[role],
  })),
];

interface AdminUserColumnHandlers {
  pendingIds: Set<string>;
  onToggleStatus: (user: AdminUserSummary) => void;
  onResetCredentials: (user: AdminUserSummary) => void;
  onInitiateDeletion: (user: AdminUserSummary) => void;
}

interface ConfirmDialogCopy {
  destructive: boolean;
  icon: 'Trash' | 'ArrowClockwise';
  confirmIcon?: 'Trash';
  title: string;
  body?: string;
  confirmLabel: string;
}

function userMatchesFilters(
  user: AdminUserSummary,
  query: string,
  statusFilter: StatusFilter,
  roleFilter: RoleFilter,
) {
  if (query) {
    const inName = user.fullName.toLowerCase().includes(query);
    const inEmail = user.email?.toLowerCase().includes(query) ?? false;
    if (!inName && !inEmail) return false;
  }

  return (
    (statusFilter === 'all' || user.status === statusFilter) &&
    (!roleFilter || user.role === roleFilter)
  );
}

function buildUserQueryParams(
  nextCursor: string,
  statusFilter: StatusFilter,
  roleFilter: RoleFilter,
  searchQuery: string,
) {
  const params = new URLSearchParams({ cursor: nextCursor });
  const query = searchQuery.trim();

  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (roleFilter) params.set('role', roleFilter);
  if (query) params.set('q', query);

  return params;
}

function getConfirmDialogCopy(action: UserConfirmAction | null): ConfirmDialogCopy {
  if (!action) {
    return {
      destructive: false,
      icon: 'ArrowClockwise',
      title: '',
      confirmLabel: '',
    };
  }

  if (action.kind === 'initiate-deletion') {
    return {
      destructive: true,
      icon: 'Trash',
      confirmIcon: 'Trash',
      title: 'Inițiezi ștergerea?',
      body: `Contul ${action.user.fullName} va intra într-o perioadă de grație de 30 de zile înainte de ștergere.`,
      confirmLabel: 'Inițiază ștergerea',
    };
  }

  if (action.user.role === 'student') {
    return {
      destructive: false,
      icon: 'ArrowClockwise',
      title: 'Resetezi PIN-ul?',
      body: `Generează un PIN nou pentru ${action.user.fullName}. PIN-ul va fi afișat o singură dată.`,
      confirmLabel: 'Generează PIN',
    };
  }

  return {
    destructive: false,
    icon: 'ArrowClockwise',
    title: 'Trimiți resetarea parolei?',
    body: `Trimite un email de resetare a parolei către ${action.user.fullName}.`,
    confirmLabel: 'Trimite email',
  };
}

function renderNameCell(user: AdminUserSummary) {
  return (
    <div className="flex flex-col gap-0.5 text-left">
      <span className="text-[14px] font-bold text-on-surface leading-tight">
        {user.fullName}
      </span>
      {user.email ? (
        <span className="text-[12px] text-on-surface-variant leading-snug truncate max-w-[34ch]">
          {user.email}
        </span>
      ) : (
        <span className="text-[12px] text-on-surface-variant italic">Fără email</span>
      )}
    </div>
  );
}

function renderUserStatus(user: AdminUserSummary) {
  return user.status === 'active' ? (
    <Pill tone="lime">Activ</Pill>
  ) : (
    <Pill tone="cream">Suspendat</Pill>
  );
}

function renderOptionalDate(value: string | null) {
  return value ? (
    <span className="text-[13px] text-on-surface-variant tabular-nums">
      {formatDateShort(value)}
    </span>
  ) : (
    <span className="text-[12px] text-on-surface-variant italic">Niciodată</span>
  );
}

function createUserActionMenu(
  user: AdminUserSummary,
  { pendingIds, onToggleStatus, onResetCredentials, onInitiateDeletion }: AdminUserColumnHandlers,
) {
  const pending = pendingIds.has(user.id);
  const isActive = user.status === 'active';
  const isStudent = user.role === 'student';

  return (
    <RowActionMenu
      triggerLabel={`Acțiuni pentru ${user.fullName}`}
      items={[
        {
          key: 'toggle-status',
          label: isActive ? 'Suspendă' : 'Reactivează',
          icon: isActive ? 'UserMinus' : 'UserPlus',
          disabled: pending,
          onSelect: () => onToggleStatus(user),
        },
        {
          key: 'reset',
          label: isStudent ? 'Resetează PIN' : 'Resetează parola',
          icon: 'ArrowClockwise',
          disabled: pending,
          onSelect: () => onResetCredentials(user),
        },
        {
          key: 'delete',
          label: 'Inițiază ștergerea',
          icon: 'Trash',
          destructive: true,
          disabled: pending,
          onSelect: () => onInitiateDeletion(user),
        },
      ]}
    />
  );
}

function createAdminUserColumns(
  handlers: AdminUserColumnHandlers,
): DataTableColumn<AdminUserSummary>[] {
  return [
    {
      key: 'name',
      header: 'Utilizator',
      cell: renderNameCell,
    },
    {
      key: 'role',
      header: 'Rol',
      cell: (user) => <Pill>{ROLE_LABEL[user.role]}</Pill>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: renderUserStatus,
    },
    {
      key: 'lastSignInAt',
      header: 'Ultima conectare',
      cell: (user) => renderOptionalDate(user.lastSignInAt),
      hideOnMobile: true,
    },
    {
      key: 'createdAt',
      header: 'Creat',
      cell: (user) => (
        <span className="text-[13px] text-on-surface-variant tabular-nums">
          {formatDateShort(user.createdAt)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Acțiuni</span>,
      align: 'right',
      cell: (user) => createUserActionMenu(user, handlers),
    },
  ];
}

export interface AdminUsersTableProps {
  initialUsers: AdminUserSummary[];
  initialNextCursor: string | null;
  totals: {
    active: number;
    suspended: number;
  };
}

export function AdminUsersTable({
  initialUsers,
  initialNextCursor,
  totals,
}: AdminUsersTableProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<AdminUserSummary[]>(initialUsers);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [pinReveal, setPinReveal] = useState<{ user: AdminUserSummary; pin: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<UserConfirmAction | null>(null);

  useEffect(() => {
    setUsers(initialUsers);
    setNextCursor(initialNextCursor);
  }, [initialUsers, initialNextCursor]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter((user) =>
      userMatchesFilters(user, query, statusFilter, roleFilter),
    );
  }, [users, searchQuery, statusFilter, roleFilter]);

  // Chip counts are point-in-time snapshots from the server — keep them
  // independent of paginated loads (`Încarcă următorii` appending more rows
  // would otherwise inflate the totals beyond reality) and of in-memory
  // mutations (per-row Status pills already reflect the live state, so the
  // chip can stay slightly stale until the page is refreshed).
  const counts = useMemo(
    () => ({
      total: totals.active + totals.suspended,
      active: totals.active,
      suspended: totals.suspended,
    }),
    [totals],
  );

  const setPending = (id: string, value: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleStatus = async (user: AdminUserSummary) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    setPending(user.id, true);
    try {
      const response = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Nu am putut actualiza statusul');
      }

      setUsers((current) =>
        current.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u)),
      );
      toast({
        message: newStatus === 'suspended' ? 'Cont suspendat' : 'Cont reactivat',
        variant: 'success',
      });
      router.refresh();
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Eroare la actualizarea contului',
        variant: 'error',
      });
    } finally {
      setPending(user.id, false);
    }
  };

  const resetCredentials = async (user: AdminUserSummary) => {
    setPending(user.id, true);
    try {
      const response = await fetch(`/api/v1/admin/users/${user.id}/reset-credentials`, {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Nu am putut reseta credențialele');
      }
      const data = result.data as ResetCredentialsResponse;

      if (data.channel === 'pin' && data.pin) {
        setPinReveal({ user, pin: data.pin });
      } else if (data.channel === 'email' && data.emailSentTo) {
        toast({
          message: 'Email de resetare trimis',
          description: data.emailSentTo,
          variant: 'success',
        });
      }
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Eroare la resetare',
        variant: 'error',
      });
    } finally {
      setPending(user.id, false);
    }
  };

  const initiateDeletion = async (user: AdminUserSummary) => {
    setPending(user.id, true);
    try {
      const response = await fetch(`/api/v1/admin/users/${user.id}/initiate-deletion`, {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Nu am putut iniția ștergerea');
      }
      toast({
        message: 'Cerere de ștergere creată',
        description: 'Contul va fi șters după 30 de zile dacă nu se anulează.',
        variant: 'success',
      });
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Eroare la cererea de ștergere',
        variant: 'error',
      });
    } finally {
      setPending(user.id, false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const params = buildUserQueryParams(nextCursor, statusFilter, roleFilter, searchQuery);

      const response = await fetch(`/api/v1/admin/users?${params.toString()}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Nu am putut încărca utilizatorii');
      }
      const newUsers = result.data as AdminUserSummary[];
      const cursorMeta = (result.meta?.nextCursor as string | null) ?? null;
      setUsers((current) => [...current, ...newUsers]);
      setNextCursor(cursorMeta);
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Eroare la încărcare',
        variant: 'error',
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const statusChips: FilterChip<StatusFilter>[] = [
    { value: 'all', label: 'Toți', count: counts.total },
    { value: 'active', label: 'Activi', count: counts.active },
    { value: 'suspended', label: 'Suspendați', count: counts.suspended },
  ];

  const columns = createAdminUserColumns({
    pendingIds,
    onToggleStatus: (user) => {
      void toggleStatus(user);
    },
    onResetCredentials: (user) => {
      setConfirmAction({ kind: 'reset-credentials', user });
    },
    onInitiateDeletion: (user) => {
      setConfirmAction({ kind: 'initiate-deletion', user });
    },
  });

  const isFiltering =
    searchQuery.trim().length > 0 || statusFilter !== 'all' || roleFilter !== '';
  const emptyTitle = isFiltering ? 'Niciun utilizator nu corespunde filtrelor' : 'Nu există utilizatori';
  const emptyDescription = isFiltering
    ? 'Încearcă să modifici căutarea sau filtrele active.'
    : 'Înregistrările vor apărea aici după primele înscrieri.';
  const confirmCopy = getConfirmDialogCopy(confirmAction);

  return (
    <div className="flex flex-col gap-5">
      <FilterBar<StatusFilter>
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Caută după nume sau email"
        searchLabel="Caută utilizatori"
        chips={statusChips}
        activeChip={statusFilter}
        onChipChange={setStatusFilter}
        trailing={
          <FilterSelect
            ariaLabel="Filtrează după rol"
            icon="Users"
            value={roleFilter}
            onChange={(value) => setRoleFilter(value as RoleFilter)}
            options={ROLE_FILTER_OPTIONS}
            radius="md"
            width={184}
          />
        }
      />

      <DataTable<AdminUserSummary>
        columns={columns}
        rows={filteredUsers}
        getRowKey={(u) => u.id}
        caption="Utilizatori platformă"
        className="border border-outline-variant shadow-none"
        empty={{
          icon: 'Users',
          title: emptyTitle,
          description: emptyDescription,
        }}
      />

      {nextCursor ? (
        <div className="flex justify-end rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3">
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

      {pinReveal ? (
        <PinRevealDialog
          user={pinReveal.user}
          pin={pinReveal.pin}
          onClose={() => setPinReveal(null)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmAction !== null}
        destructive={confirmCopy.destructive}
        icon={confirmCopy.icon}
        confirmIcon={confirmCopy.confirmIcon}
        title={confirmCopy.title}
        body={confirmCopy.body}
        confirmLabel={confirmCopy.confirmLabel}
        cancelLabel="Renunță"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          const action = confirmAction;
          if (!action) return;
          setConfirmAction(null);
          if (action.kind === 'initiate-deletion') {
            void initiateDeletion(action.user);
            return;
          }
          void resetCredentials(action.user);
        }}
      />
    </div>
  );
}

interface PinRevealDialogProps {
  user: AdminUserSummary;
  pin: string;
  onClose: () => void;
}

function PinRevealDialog({ user, pin, onClose }: PinRevealDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail in restricted contexts; surface the PIN
      // visually so the admin can copy it manually.
      setCopied(false);
    }
  };

  return (
    <Modal
      opened
      onClose={onClose}
      centered
      radius="md"
      size="md"
      title={
        <div className="min-w-0">
          <span className="block text-[20px] font-bold text-on-surface">
            PIN nou pentru {user.fullName}
          </span>
          <p className="mt-1 text-[13px] text-on-surface-variant">
            PIN-ul este afișat o singură dată. Notează-l sau copiază-l acum.
          </p>
        </div>
      }
      closeButtonProps={{ 'aria-label': 'Închide' }}
      overlayProps={{ backgroundOpacity: 0.25, color: 'var(--color-ink)' }}
      styles={{
        content: {
          backgroundColor: 'var(--color-surface-container-lowest)',
          border: '1px solid var(--color-outline-variant)',
        },
        header: {
          borderBottom: '1px solid var(--color-outline-variant)',
          padding: 'var(--mantine-spacing-md) var(--mantine-spacing-lg)',
        },
        body: {
          padding: 0,
        },
        close: {
          minHeight: 44,
          minWidth: 44,
        },
      }}
    >
        <div className="px-5 py-5">
          <div
            className="rounded-lg border border-outline-variant bg-surface px-4 py-5 text-center font-mono text-[36px] font-bold tracking-[0.4em] text-on-surface"
            aria-live="polite"
          >
            {pin}
          </div>
        </div>
        <footer className="flex flex-col gap-2 border-t border-outline-variant px-5 py-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            <Icon name={copied ? 'Check' : 'Copy'} size="sm" aria-hidden />
            {copied ? 'Copiat' : 'Copiază'}
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Închide
          </Button>
        </footer>
    </Modal>
  );
}
