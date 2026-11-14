'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/shared/components/ui/Icon';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  FilterChipGroup,
  Pill,
  SubjectPill,
  TextField,
  type DataTableColumn,
  type SortDirection,
} from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'
import { formatRelativeTime, formatPercent } from '@/lib/i18n/formatters'

export interface StudentRow {
  id: string
  username: string
  class_id: string | null
  profiles: {
    full_name: string
    email: string
    avatar_url: string | null
  } | null
  isActive: boolean
  progressPercent: number
  lastActiveAt: string | null
}

export interface StudentsPageContentProps {
  profile: {
    id: string
    full_name: string
    email: string
    role: string
    avatar_url?: string | null
  }
  students: StudentRow[]
  classMap: Record<string, string>
}

type FilterValue = 'all' | 'active' | 'inactive'

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'Toți' },
  { value: 'active', label: 'Activi' },
  { value: 'inactive', label: 'Inactivi' },
]

const SORT_KEYS = ['name', 'class', 'status', 'progress', 'lastActive'] as const
type SortKey = (typeof SORT_KEYS)[number]

function isFilterValue(value: string | null): value is FilterValue {
  return value === 'active' || value === 'inactive' || value === 'all'
}

export function StudentsPageContent({ students, classMap }: StudentsPageContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filterParam = searchParams.get('filter')
  const filter: FilterValue = isFilterValue(filterParam) ? filterParam : 'all'

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  function setFilter(next: FilterValue) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'all') {
      params.delete('filter')
    } else {
      params.set('filter', next)
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const filteredRows = useMemo(() => {
    let rows = students
    if (filter === 'active') rows = rows.filter((s) => s.isActive)
    if (filter === 'inactive') rows = rows.filter((s) => !s.isActive)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(
        (s) =>
          (s.profiles?.full_name ?? '').toLowerCase().includes(q) ||
          s.username.toLowerCase().includes(q),
      )
    }

    const sorted = [...rows].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1
      const fa = a.profiles?.full_name ?? a.username
      const fb = b.profiles?.full_name ?? b.username

      switch (sortKey) {
        case 'name':
          return fa.localeCompare(fb, 'ro') * direction
        case 'class': {
          const ca = a.class_id ? (classMap[a.class_id] ?? '') : ''
          const cb = b.class_id ? (classMap[b.class_id] ?? '') : ''
          return ca.localeCompare(cb, 'ro') * direction
        }
        case 'status':
          return (Number(b.isActive) - Number(a.isActive)) * direction
        case 'progress':
          return (a.progressPercent - b.progressPercent) * direction
        case 'lastActive': {
          const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0
          const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0
          return (ta - tb) * direction
        }
        default:
          return 0
      }
    })

    return sorted
  }, [students, filter, search, sortKey, sortDirection, classMap])

  function handleSortChange(key: string, direction: SortDirection) {
    if ((SORT_KEYS as readonly string[]).includes(key)) {
      setSortKey(key as SortKey)
      setSortDirection(direction)
    }
  }

  const isFiltered = filter !== 'all' || search.trim() !== ''

  const columns: DataTableColumn<StudentRow>[] = [
    {
      key: 'name',
      header: 'Elev',
      sortable: true,
      cell: (row) => <StudentCell row={row} />,
      mobileLabel: 'Elev',
      mobileRender: (row) => (
        <div className="flex items-center justify-end gap-3">
          <div className="text-right">
            <p className="font-bold text-on-surface">{row.profiles?.full_name ?? row.username}</p>
            <p className="text-xs text-on-surface-variant">@{row.username}</p>
          </div>
          <StudentAvatar row={row} />
        </div>
      ),
    },
    {
      key: 'class',
      header: 'Clasă',
      sortable: true,
      cell: (row) =>
        row.class_id ? (
          <SubjectPill tone="neutral">{classMap[row.class_id] ?? 'Necunoscută'}</SubjectPill>
        ) : (
          <span className="text-on-surface-variant text-sm">Fără clasă</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => (
        <Pill tone={row.isActive ? 'lime' : 'neutral'}>{row.isActive ? 'Activ' : 'Inactiv'}</Pill>
      ),
    },
    {
      key: 'progress',
      header: 'Progres',
      sortable: true,
      align: 'right',
      cell: (row) => <ProgressBar value={row.progressPercent} />,
      mobileRender: (row) => (
        <span className="font-bold text-on-surface tabular-nums">{formatPercent(row.progressPercent)}</span>
      ),
    },
    {
      key: 'lastActive',
      header: 'Ultima activitate',
      sortable: true,
      align: 'right',
      cell: (row) =>
        row.lastActiveAt ? (
          <span className="text-on-surface-variant text-sm">{formatRelativeTime(row.lastActiveAt)}</span>
        ) : (
          <span className="text-outline text-sm">—</span>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Acțiuni</span>,
      align: 'right',
      cell: (row) => (
        <Link
          href={ROUTES.TEACHER.STUDENT(row.id)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full px-3 py-2 min-h-[44px]"
        >
          Vezi detalii
          <Icon name="CaretRight" size={18} aria-hidden />
        </Link>
      ),
      mobileLabel: ' ',
      mobileRender: (row) => (
        <Link
          href={ROUTES.TEACHER.STUDENT(row.id)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
        >
          Vezi detalii
          <Icon name="CaretRight" size={18} aria-hidden />
        </Link>
      ),
    },
  ]

  const emptyState =
    students.length === 0 ? (
      <EmptyState
        icon="Users"
        title="Încă nu ai adăugat elevi"
        description="Adaugă primul elev pentru a-i da acces la jocurile educaționale și a-i urmări progresul."
        action={
          <Button href={ROUTES.TEACHER.STUDENT_NEW}>
            <Icon name="Plus" size={20} aria-hidden />
            Adaugă elev
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon="FunnelSimple"
        title="Niciun elev nu corespunde filtrului"
        description="Schimbă filtrul sau termenii de căutare pentru a vedea mai mulți elevi."
      />
    )

  return (
    <div className="min-h-screen bg-surface-container text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-deep">Portofolii elevi</p>
            <h1 className="font-headline text-2xl font-bold leading-tight text-on-surface md:text-3xl">Elevii Mei</h1>
            <p className="text-sm font-medium text-on-surface-variant">Gestionează conturile elevilor tăi</p>
          </div>
          <Button href={ROUTES.TEACHER.STUDENT_NEW}>
            <Icon name="Plus" size={20} aria-hidden />
            Elev nou
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-5 px-6 py-6 lg:px-10">
        {students.length > 0 && (
          <Card className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <FilterChipGroup
                ariaLabel="Filtrează elevi"
                items={FILTER_OPTIONS}
                value={filter}
                onChange={(next) => setFilter(next as FilterValue)}
                radius="md"
              />
              <TextField
                label="Caută elevi"
                labelHidden
                icon="MagnifyingGlass"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Caută elevi…"
                className="w-full md:w-96"
              />
            </div>
          </Card>
        )}

        <DataTable<StudentRow>
          columns={columns}
          rows={filteredRows}
          getRowKey={(row) => row.id}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          empty={emptyState}
          caption={isFiltered ? 'Listă elevi filtrată' : 'Listă elevi'}
        />
      </main>
    </div>
  )
}

function StudentAvatar({ row }: { row: StudentRow }) {
  const profileData = row.profiles
  const displayName = profileData?.full_name || row.username
  if (profileData?.avatar_url) {
    return (
      <div className="relative w-10 h-10 rounded-full overflow-hidden border border-outline-variant bg-surface-container">
        <Image src={profileData.avatar_url} alt={displayName} fill className="object-cover" sizes="40px" />
      </div>
    )
  }
  return (
    <div className="w-10 h-10 rounded-full bg-primary-wash text-primary-deep flex items-center justify-center text-sm font-bold border border-outline-variant">
      {displayName.charAt(0).toUpperCase()}
    </div>
  )
}

function StudentCell({ row }: { row: StudentRow }) {
  return (
    <div className="flex items-center gap-3">
      <StudentAvatar row={row} />
      <div>
        <p className="font-bold text-on-surface">{row.profiles?.full_name ?? row.username}</p>
        <p className="text-xs text-on-surface-variant">@{row.username}</p>
      </div>
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="flex items-center justify-end gap-2 min-w-[140px]">
      <div
        className="flex-1 max-w-[110px] h-2 rounded-full bg-surface-container overflow-hidden"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progres ${formatPercent(clamped)}`}
      >
        <div
          className="h-full bg-primary"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-on-surface tabular-nums">{formatPercent(clamped)}</span>
    </div>
  )
}
