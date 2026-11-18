'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/Icon'
import {
  DataTable,
  DuoAvatar,
  DuoProgress,
  EmptyState,
  ToolbarRow,
  type DataTableColumn,
  type ToolbarFilter,
} from '@/shared/components/ui/kit'
import { StudentStatusBadge } from './StudentStatusBadge'
import { ROUTES } from '@/shared/lib/constants'

type StudentStatus = 'online' | 'needs_help' | 'offline'

interface RosterStudent {
  id: string
  fullName: string
  username: string
  avatarUrl: string | null
  status: StudentStatus
  recentGameTitle: string | null
  recentGameTime: string | null
  lessonProgress: number
  totalScore: number
}

interface StudentRosterTableProps {
  students: RosterStudent[]
  classId: string
}

type FilterOption = 'all' | 'online' | 'needs_help'

const FOCUS_RING =
  'focus-ring'

type ProgressTone = 'green' | 'blue' | 'coral'

function getProgressTone(progress: number): ProgressTone {
  if (progress >= 100) return 'green'
  if (progress < 30) return 'coral'
  return 'blue'
}

export function StudentRosterTable({ students, classId }: StudentRosterTableProps) {
  void classId
  const { t } = useTranslation('teacher')
  const [filter, setFilter] = useState<FilterOption>('all')
  const [search, setSearch] = useState('')

  const filters = useMemo<ReadonlyArray<ToolbarFilter<FilterOption>>>(
    () => [
      { key: 'all', label: t('classes.detail.roster.filters.all') },
      { key: 'online', label: t('classes.detail.roster.filters.online') },
      { key: 'needs_help', label: t('classes.detail.roster.filters.needsHelp') },
    ],
    [t],
  )

  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return students.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false
      if (!q) return true
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q)
      )
    })
  }, [students, filter, search])

  const formatRelative = useMemo(() => {
    return (timestamp: string | null): string => {
      if (!timestamp) return ''
      const now = new Date()
      const date = new Date(timestamp)
      const diffMs = now.getTime() - date.getTime()
      const diffMin = Math.floor(diffMs / 60000)
      if (diffMin < 1) return t('classes.detail.relativeTime.now')
      if (diffMin < 60)
        return t('classes.detail.relativeTime.minutesAgo', { count: diffMin })
      const diffHours = Math.floor(diffMin / 60)
      if (diffHours < 24) {
        const key =
          diffHours === 1
            ? 'classes.detail.relativeTime.hoursAgoOne'
            : 'classes.detail.relativeTime.hoursAgoOther'
        return t(key, { count: diffHours })
      }
      const diffDays = Math.floor(diffHours / 24)
      if (diffDays === 1) return t('classes.detail.relativeTime.yesterday')
      const key =
        diffDays === 1
          ? 'classes.detail.relativeTime.daysAgoOne'
          : 'classes.detail.relativeTime.daysAgoOther'
      return t(key, { count: diffDays })
    }
  }, [t])

  const emptyTitle =
    filter === 'online'
      ? t('classes.detail.roster.empty.noOnline')
      : filter === 'needs_help'
        ? t('classes.detail.roster.empty.noNeedsHelp')
        : search
          ? t('classes.detail.roster.empty.noResults')
          : t('classes.detail.roster.empty.noStudents')
  const emptyDescription =
    search && filter === 'all'
      ? t('classes.detail.roster.empty.tryOtherTerms')
      : t('classes.detail.roster.empty.addStudent')

  const columns: DataTableColumn<RosterStudent>[] = [
    {
      key: 'student',
      header: t('classes.detail.roster.columns.student'),
      cell: (s) => (
        <div className="flex items-center gap-3">
          {s.avatarUrl ? (
            <Image
              src={s.avatarUrl}
              alt={s.fullName}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <DuoAvatar name={s.fullName} size={40} />
          )}
          <div className="min-w-0">
            <p className="truncate font-bold text-on-surface">{s.fullName}</p>
            <p className="text-xs text-on-surface-variant">@{s.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('classes.detail.roster.columns.status'),
      cell: (s) => <StudentStatusBadge status={s.status} />,
    },
    {
      key: 'activity',
      header: t('classes.detail.roster.columns.activity'),
      hideOnMobile: true,
      cell: (s) => (
        <div className="text-sm">
          <p className="font-medium text-on-surface">
            {s.recentGameTitle || t('classes.detail.roster.noActivity')}
          </p>
          {s.recentGameTime ? (
            <p className="text-xs text-on-surface-variant">
              {formatRelative(s.recentGameTime)}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'progress',
      header: t('classes.detail.roster.columns.progress'),
      cell: (s) => (
        <div className="w-32">
          <div className="mb-1 text-[11px] font-bold text-on-surface">
            {s.lessonProgress}%
          </div>
          <DuoProgress
            value={s.lessonProgress}
            tone={getProgressTone(s.lessonProgress)}
            height={6}
          />
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('classes.detail.roster.columns.actions'),
      align: 'right',
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Link
            href={ROUTES.TEACHER.STUDENT_REPORT(s.id)}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-primary transition-colors hover:bg-primary/10 ${FOCUS_RING}`}
            aria-label={t('classes.detail.roster.actions.viewReport', {
              name: s.fullName,
            })}
          >
            <Icon name="ChartBar" size="lg" weight="bold" />
          </Link>
          <Link
            href={`${ROUTES.TEACHER.ACTIVITIES}?assignTo=${s.id}`}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-gold transition-colors hover:bg-gold/10 ${FOCUS_RING}`}
            aria-label={t('classes.detail.roster.actions.assignGame', {
              name: s.fullName,
            })}
          >
            <Icon name="PuzzlePiece" size="lg" weight="bold" />
          </Link>
        </div>
      ),
      mobileRender: (s) => (
        <div className="flex gap-1">
          <Link
            href={ROUTES.TEACHER.STUDENT_REPORT(s.id)}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-primary transition-colors hover:bg-primary/10 ${FOCUS_RING}`}
            aria-label={t('classes.detail.roster.actions.viewReport', {
              name: s.fullName,
            })}
          >
            <Icon name="ChartBar" size="lg" weight="bold" />
          </Link>
          <Link
            href={`${ROUTES.TEACHER.ACTIVITIES}?assignTo=${s.id}`}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-gold transition-colors hover:bg-gold/10 ${FOCUS_RING}`}
            aria-label={t('classes.detail.roster.actions.assignGame', {
              name: s.fullName,
            })}
          >
            <Icon name="PuzzlePiece" size="lg" weight="bold" />
          </Link>
        </div>
      ),
    },
  ]

  const total = students.length
  const viewAllLabel =
    total === 1
      ? t('classes.detail.roster.viewAllOne', { count: total })
      : t('classes.detail.roster.viewAllOther', { count: total })

  return (
    <section aria-labelledby="roster-heading" className="space-y-5">
      <h2
        id="roster-heading"
        className="font-headline text-[20px] font-bold text-on-surface"
      >
        {t('classes.detail.roster.heading')}
      </h2>

      <ToolbarRow<FilterOption>
        aria-label={t('classes.detail.roster.filters.ariaLabel')}
        filters={filters}
        activeFilterKey={filter}
        onFilterChange={(key) => setFilter(key)}
        search={{
          'aria-label': t('classes.detail.roster.search.ariaLabel'),
          placeholder: t('classes.detail.roster.search.placeholder'),
          value: search,
          onChange: (event) => setSearch(event.target.value),
        }}
      />

      <DataTable
        columns={columns}
        rows={visibleStudents}
        getRowKey={(s) => s.id}
        caption={t('classes.detail.roster.tableCaption')}
        empty={
          <EmptyState
            icon="Users"
            title={emptyTitle}
            description={emptyDescription}
          />
        }
      />

      <div className="text-center">
        <Link
          href={ROUTES.TEACHER.STUDENTS}
          className={`text-sm font-bold text-primary hover:underline ${FOCUS_RING}`}
        >
          {viewAllLabel}
        </Link>
      </div>
    </section>
  )
}
