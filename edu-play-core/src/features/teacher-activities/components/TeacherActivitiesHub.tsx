'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Button as MantineButton, UnstyledButton } from '@mantine/core'

import { TeacherGamesPageContent, type Game } from '@/features/games'
import { formatDateShort } from '@/lib/i18n/formatters'
import { Button, Card, ConfirmDialog, FilterChipGroup, Pill, TextField, useToast } from '@/shared/components/ui/kit'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { ROUTES } from '@/shared/lib/constants'
import { cn } from '@/shared/lib/utils/cn'
import { ActivityCardMenu, type ActivityCardMenuItem } from './ActivityCardMenu'
import { ActivityActionButton, type ActivityActionTone } from './ActivityActionButton'
import { MakeActivityReadyForm } from './MakeActivityReadyForm'
import { RestoreActivityForm } from './RestoreActivityForm'
import {
  archiveTeacherActivity,
  createTeacherActivityPreview,
  duplicateTeacherActivity,
} from '../actions'
import type {
  TeacherActivitiesStatusFilter,
  TeacherActivitiesTab,
  TeacherOwnedActivity,
  TeacherOwnedActivityStatus,
} from '../types'

export type OwnedActivitySort = 'newest' | 'oldest' | 'title'

interface TeacherActivitiesHubProps {
  activeTab: TeacherActivitiesTab
  statusFilter: TeacherActivitiesStatusFilter
  sortBy?: OwnedActivitySort
  libraryActivities: Game[]
  ownedActivities: TeacherOwnedActivity[]
  libraryHref?: string
  ownedHref?: string
}

const STATUS_OPTIONS: Array<{
  value: TeacherActivitiesStatusFilter
  label: string
  description: string
}> = [
  { value: 'all', label: 'Toate active', description: 'Tot ce nu este arhivat' },
  { value: 'draft', label: 'Ciorne', description: 'Necesită editare' },
  { value: 'published', label: 'Gata', description: 'Pot fi atribuite' },
  { value: 'in_review', label: 'În revizuire', description: 'Așteaptă verificare' },
  { value: 'archived', label: 'Arhivate', description: 'Puse deoparte' },
]

const STATUS_LABELS: Record<TeacherOwnedActivityStatus, string> = {
  draft: 'Ciornă',
  published: 'Gata de atribuit',
  archived: 'Arhivată',
  in_review: 'În revizuire',
}

const STATUS_TONES: Record<TeacherOwnedActivityStatus, 'neutral' | 'lime' | 'sun' | 'coral' | 'purple'> = {
  draft: 'sun',
  published: 'lime',
  archived: 'neutral',
  in_review: 'purple',
}

const STATUS_META: Record<
  TeacherOwnedActivityStatus,
  {
    icon: IconName
    iconClass: string
    nextStep: string
  }
> = {
  draft: {
    icon: 'PencilSimple',
    iconClass: 'bg-gold-soft text-gold-deep',
    nextStep: 'Pas următor: continuă editarea, apoi marcheaz-o ca gata pentru atribuire.',
  },
  published: {
    icon: 'PaperPlaneTilt',
    iconClass: 'bg-primary-soft text-primary-deep',
    nextStep: 'Pas următor: atribuie activitatea unei clase sau unui elev.',
  },
  archived: {
    icon: 'Archive',
    iconClass: 'bg-surface-container text-on-surface-variant',
    nextStep: 'Pas următor: restaurează activitatea dacă vrei să lucrezi din nou cu ea.',
  },
  in_review: {
    icon: 'Eye',
    iconClass: 'bg-purple-soft text-purple-deep',
    nextStep: 'Pas următor: verifică răspunsurile și aprobă ce poate fi partajat.',
  },
}

const TYPE_LABELS: Record<string, string> = {
  'free-response': 'Răspuns liber',
  'listen-tap': 'Ascultă și apasă',
  'multiple-choice': 'Întrebări',
  'matching-game': 'Potrivire',
}

const TOOL_LABELS: Record<string, string> = {
  text: 'Text',
  drawing: 'Desen',
  voice: 'Voce',
}

function tabHref(tab: TeacherActivitiesTab, libraryHref: string, ownedHref: string) {
  return tab === 'library' ? libraryHref : ownedHref
}

function hrefWithOwnedFilters(
  baseHref: string,
  status: TeacherActivitiesStatusFilter,
  sort?: OwnedActivitySort,
) {
  const [pathname, query = ''] = baseHref.split('?', 2)
  const params = new URLSearchParams(query)
  if (status === 'all') {
    params.delete('status')
  } else {
    params.set('status', status)
  }
  if (!sort || sort === 'newest') {
    params.delete('sort')
  } else {
    params.set('sort', sort)
  }
  const serialized = params.toString()
  return serialized ? `${pathname}?${serialized}` : pathname
}

function statusHref(ownedHref: string, status: TeacherActivitiesStatusFilter, sort?: OwnedActivitySort) {
  return hrefWithOwnedFilters(ownedHref, status, sort)
}

function sortHref(ownedHref: string, status: TeacherActivitiesStatusFilter, sort: OwnedActivitySort) {
  return hrefWithOwnedFilters(ownedHref, status, sort)
}

const SORT_OPTIONS: Array<{ value: OwnedActivitySort; label: string }> = [
  { value: 'newest', label: 'Cele mai recente' },
  { value: 'oldest', label: 'Cele mai vechi' },
  { value: 'title', label: 'Alfabetic' },
]

function getTypeLabel(template: string) {
  return TYPE_LABELS[template] ?? template
}

function getUpdatedLabel(activity: TeacherOwnedActivity) {
  const date = activity.updatedAt ?? activity.createdAt
  return date ? `Actualizată ${formatDateShort(date)}` : 'Fără dată'
}

function activityTime(value?: string | null) {
  return value ? new Date(value).getTime() : 0
}

const OWNED_ACTIVITY_SORTERS: Record<OwnedActivitySort, (a: TeacherOwnedActivity, b: TeacherOwnedActivity) => number> = {
  newest: (a, b) => activityTime(b.updatedAt ?? b.createdAt) - activityTime(a.updatedAt ?? a.createdAt),
  oldest: (a, b) => activityTime(a.createdAt) - activityTime(b.createdAt),
  title: (a, b) => a.title.localeCompare(b.title, 'ro'),
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function getPromptPreview(activity: TeacherOwnedActivity) {
  const prompt = asObject(activity.configData).prompt
  return typeof prompt === 'string' && prompt.trim().length > 0 ? prompt.trim() : null
}

function getToolLabels(activity: TeacherOwnedActivity) {
  const allowedTools = asObject(asObject(activity.configData).allowedTools)
  return Object.entries(TOOL_LABELS)
    .filter(([tool]) => allowedTools[tool] === true)
    .map(([, label]) => label)
}

function getCounts(ownedActivities: TeacherOwnedActivity[]) {
  const active = ownedActivities.filter((activity) => activity.status !== 'archived').length
  const draft = ownedActivities.filter((activity) => activity.status === 'draft').length
  const published = ownedActivities.filter((activity) => activity.status === 'published').length
  const inReview = ownedActivities.filter((activity) => activity.status === 'in_review').length
  const archived = ownedActivities.filter((activity) => activity.status === 'archived').length

  return { active, draft, published, inReview, archived }
}

function statusCount(counts: ReturnType<typeof getCounts>, status: TeacherActivitiesStatusFilter) {
  switch (status) {
    case 'all':
      return counts.active
    case 'draft':
      return counts.draft
    case 'published':
      return counts.published
    case 'in_review':
      return counts.inReview
    case 'archived':
      return counts.archived
  }
}

function ActivityActionLink({
  activityId,
  children,
  tone = 'secondary',
}: {
  activityId: string
  children: string
  tone?: ActivityActionTone
}) {
  return (
    <ActivityActionButton href={ROUTES.TEACHER.ACTIVITY_EDIT(activityId)} tone={tone}>
      {children}
    </ActivityActionButton>
  )
}

function TeacherOwnedActivityCard({ activity }: { activity: TeacherOwnedActivity }) {
  const { toast } = useToast()
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<'preview' | 'duplicate' | 'archive' | null>(null)
  const [, startTransition] = useTransition()
  const isReady = activity.status === 'published'
  const isArchived = activity.status === 'archived'
  const promptPreview = getPromptPreview(activity)
  const toolLabels = getToolLabels(activity)
  const statusMeta = STATUS_META[activity.status]
  const isEditableDraft = activity.template === 'free-response' && activity.status === 'draft'
  const actionPending = pendingAction !== null

  function runMenuAction(action: NonNullable<typeof pendingAction>, task: () => Promise<void>) {
    setPendingAction(action)
    startTransition(async () => {
      try {
        await task()
      } finally {
        setPendingAction(null)
      }
    })
  }

  function handlePreview() {
    runMenuAction('preview', async () => {
      await createTeacherActivityPreview(activity.id)
    })
  }

  function handleDuplicate() {
    runMenuAction('duplicate', async () => {
      const result = await duplicateTeacherActivity(activity.id)
      if (result.success) {
        toast({ message: 'Activitatea a fost duplicată ca ciornă.', variant: 'success' })
      } else {
        toast({ message: result.error ?? 'Nu am putut duplica activitatea.', variant: 'error' })
      }
    })
  }

  function handleArchiveConfirm() {
    setConfirmArchiveOpen(false)
    runMenuAction('archive', async () => {
      const result = await archiveTeacherActivity(activity.id)
      if (result.success) {
        toast({ message: 'Activitatea a fost arhivată.', variant: 'success' })
      } else {
        toast({ message: result.error ?? 'Nu am putut arhiva activitatea.', variant: 'error' })
      }
    })
  }

  const menuItems: ActivityCardMenuItem[] = [
    ...(!isArchived
      ? [
          {
            key: 'preview',
            label: pendingAction === 'preview' ? 'Se încarcă…' : 'Previzualizează',
            icon: 'Eye' as const,
            disabled: actionPending,
            onSelect: handlePreview,
          },
        ]
      : []),
    {
      key: 'duplicate',
      label: pendingAction === 'duplicate' ? 'Se duplică…' : 'Duplică',
      icon: 'Copy' as const,
      disabled: actionPending,
      onSelect: handleDuplicate,
    },
    ...(!isArchived
      ? [
          {
            key: 'archive',
            label: pendingAction === 'archive' ? 'Se arhivează…' : 'Arhivează',
            icon: 'Archive' as const,
            destructive: true,
            disabled: actionPending,
            onSelect: () => setConfirmArchiveOpen(true),
          },
        ]
      : []),
  ]

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-soft-sm transition-colors hover:border-primary/60">
      <div className={cn('flex h-36 items-center justify-center', statusMeta.iconClass)}>
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-container-lowest/85 shadow-soft-sm">
          <Icon name={statusMeta.icon} size={34} weight="fill" aria-hidden />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-wrap gap-2">
          <Pill tone={STATUS_TONES[activity.status]}>{STATUS_LABELS[activity.status]}</Pill>
          <Pill tone="neutral">{getTypeLabel(activity.template)}</Pill>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold leading-tight text-on-surface line-clamp-2">{activity.title}</h3>
          <p className="text-xs font-semibold text-on-surface-variant">{getUpdatedLabel(activity)}</p>
        </div>

        {promptPreview ? (
          <p className="line-clamp-3 rounded-md bg-surface-container px-3 py-2 text-sm font-semibold leading-6 text-on-surface-variant">
            {promptPreview}
          </p>
        ) : (
          <p className="line-clamp-3 rounded-md border border-dashed border-outline-variant px-3 py-2 text-sm font-semibold leading-6 text-on-surface-variant">
            Fără descriere salvată. Adaugă o cerință ca să fie mai ușor de recunoscut.
          </p>
        )}

        {toolLabels.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Instrumente disponibile">
            {toolLabels.map((tool) => (
              <li
                key={tool}
                className="rounded-full bg-primary-wash px-3 py-1 text-xs font-bold text-primary-deep"
              >
                {tool}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-auto rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-bold leading-6 text-on-surface">
          {statusMeta.nextStep}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {isEditableDraft ? <ActivityActionLink activityId={activity.id} tone="primary">Continuă editarea</ActivityActionLink> : null}
          {isReady ? (
            <ActivityActionButton href={`${ROUTES.TEACHER.ASSIGNMENT_NEW}?activityId=${activity.id}`} tone="primary">
              Atribuie
            </ActivityActionButton>
          ) : null}
          {isArchived ? <RestoreActivityForm activityId={activity.id} tone="primary" /> : null}
          {activity.status === 'draft' ? <MakeActivityReadyForm activityId={activity.id} tone="secondary" /> : null}

          <ActivityCardMenu items={menuItems} />
        </div>
      </div>
      <ConfirmDialog
        open={confirmArchiveOpen}
        title="Arhivezi activitatea?"
        body="Activitatea va fi mutată în secțiunea Arhivate. O poți restaura oricând."
        confirmLabel="Arhivează"
        cancelLabel="Anulează"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setConfirmArchiveOpen(false)}
        destructive
        icon="Archive"
      />
    </article>
  )
}

function TeacherOwnedActivitiesPanel({
  ownedActivities,
  statusFilter,
  sortBy = 'newest',
  ownedHref,
}: {
  ownedActivities: TeacherOwnedActivity[]
  statusFilter: TeacherActivitiesStatusFilter
  sortBy?: OwnedActivitySort
  ownedHref: string
}) {
  const counts = getCounts(ownedActivities)
  const [searchQuery, setSearchQuery] = useState('')
  const { t } = useTranslation('teacher')
  const router = useRouter()
  const readonlyFilters = [
    {
      value: 'all-grades',
      label: t('activities.activitiesOwned.allGrades'),
      ariaLabel: t('activities.activitiesOwned.allGrades'),
    },
    {
      value: 'all-subjects',
      label: t('activities.activitiesOwned.allSubjects'),
      ariaLabel: t('activities.activitiesOwned.allSubjects'),
    },
    {
      value: 'all-languages',
      label: t('activities.activitiesOwned.allLanguages'),
      ariaLabel: t('activities.activitiesOwned.allLanguages'),
    },
  ]
  const filteredActivities = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ro')
    const visibleActivities =
      statusFilter === 'all'
        ? ownedActivities.filter((activity) => activity.status !== 'archived')
        : ownedActivities.filter((activity) => activity.status === statusFilter)

    return visibleActivities
      .filter((activity) => {
        if (!query) return true

        const promptPreview = getPromptPreview(activity)
        return (
          activity.title.toLocaleLowerCase('ro').includes(query) ||
          getTypeLabel(activity.template).toLocaleLowerCase('ro').includes(query) ||
          (promptPreview?.toLocaleLowerCase('ro').includes(query) ?? false)
        )
      })
      .sort(OWNED_ACTIVITY_SORTERS[sortBy])
  }, [ownedActivities, searchQuery, sortBy, statusFilter])

  return (
    <section className="mx-auto max-w-[1440px] space-y-6" aria-labelledby="my-activities-heading">
      <header className="flex flex-col gap-4 border-b border-outline-variant bg-surface-container-lowest px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-deep">
            {t('activities.activitiesOwned.eyebrow')}
          </p>
          <h1 id="my-activities-heading" className="font-headline text-3xl font-bold tracking-tight text-on-surface">
            {t('activities.activitiesOwned.title')}
          </h1>
          <p className="text-sm font-semibold text-on-surface-variant">
            {t('activities.activitiesOwned.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActivityActionButton href={ROUTES.TEACHER.ACTIVITY_REVIEW} tone="secondary">
            {t('activities.activitiesOwned.review')}
          </ActivityActionButton>
          <Button href={ROUTES.TEACHER.ACTIVITY_CREATE} variant="primary" size="md">
            <Icon name="PlusCircle" size="sm" aria-hidden />
            {t('activities.createActivity')}
          </Button>
        </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-soft-sm">
        {readonlyFilters.map((filter) => (
          <FilterChipGroup
            key={filter.value}
            ariaLabel={filter.ariaLabel}
            items={[{ value: filter.value, label: filter.label, disabled: true }]}
            value={filter.value}
            onChange={() => undefined}
            size="sm"
            radius="md"
            styles={{ chip: { cursor: 'default', opacity: 1 } }}
          />
        ))}
        <ActivityActionButton href={`${ownedHref}${ownedHref.includes('?') ? '&' : '?'}view=all`} tone="secondary">
          {t('activities.activitiesOwned.viewAll', { count: filteredActivities.length })}
        </ActivityActionButton>
      </div>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-soft-sm lg:flex-row lg:items-center">
        <FilterChipGroup
          ariaLabel="Filtrează activitățile mele după status"
          items={STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
            count: statusCount(counts, option.value),
          }))}
          value={statusFilter}
          onChange={(value) =>
            router.push(statusHref(ownedHref, value as TeacherActivitiesStatusFilter, sortBy))
          }
        />

        <div className="flex flex-wrap gap-3 lg:ml-auto lg:items-center">
          <TextField
            type="search"
            label={t('activities.activitiesOwned.searchLabel')}
            labelHidden
            icon="MagnifyingGlass"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('activities.activitiesOwned.searchPlaceholder')}
            className="min-w-0 sm:w-64"
            inputStyle={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-outline-variant)',
              boxShadow: 'none',
              fontSize: 14,
              fontWeight: 600,
              minHeight: 44,
            }}
          />
          <FilterChipGroup
            ariaLabel="Sortare"
            items={SORT_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            value={sortBy}
            onChange={(value) => router.push(sortHref(ownedHref, statusFilter, value as OwnedActivitySort))}
            size="xs"
          />
        </div>
      </div>

      <div className="flex items-baseline gap-3">
        <h2 className="text-xl font-bold text-on-surface">{t('activities.activitiesOwned.recent')}</h2>
        <span className="ml-auto text-sm font-bold text-on-surface-variant">
          {t('activities.activitiesOwned.count', { count: filteredActivities.length })}
        </span>
      </div>

      {filteredActivities.length === 0 ? (
        <Card padding="none" shadow={false} className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <Icon name="BookOpen" size={52} className="text-outline-variant" aria-hidden />
          <h2 className="text-xl font-bold text-on-surface">
            {statusFilter === 'draft' ? t('activities.activitiesOwned.emptyDraft') : t('activities.activitiesOwned.empty')}
          </h2>
          <p className="max-w-xl text-sm font-semibold leading-6 text-on-surface-variant">
            {t('activities.activitiesOwned.emptyBody')}
          </p>
          <Button href={ROUTES.TEACHER.ACTIVITY_CREATE} variant="primary" size="md">
            <Icon name="PlusCircle" size="sm" aria-hidden />
            {t('activities.createActivity')}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <UnstyledButton
              component={Link}
              href={ROUTES.TEACHER.ACTIVITY_CREATE}
              className="flex min-h-72 flex-col justify-center rounded-xl border border-dashed border-primary/50 bg-primary-soft/40 p-5 text-on-surface transition-colors hover:bg-primary-soft"
            >
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-on-primary shadow-soft-sm">
                <Icon name="PlusCircle" size={28} weight="fill" aria-hidden />
              </span>
              <span className="text-lg font-bold leading-tight">{t('activities.activitiesOwned.createCardTitle')}</span>
              <span className="mt-2 text-sm font-semibold leading-6 text-on-surface-variant">
                {t('activities.activitiesOwned.createCardBody')}
              </span>
            </UnstyledButton>
            {filteredActivities.map((activity) => (
              <TeacherOwnedActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
          <aside className="space-y-4">
            <Card className="border border-outline-variant bg-surface-container-lowest" padding="md" shadow={false}>
              <h3 className="font-headline text-lg font-bold text-on-surface">{t('activities.activitiesOwned.needIdeas')}</h3>
              <ActivityActionButton href={ROUTES.TEACHER.LIBRARIES_EXPLORE} tone="secondary">
                {t('activities.activitiesOwned.browseCommunity')}
              </ActivityActionButton>
            </Card>
            <Card className="border border-outline-variant bg-surface-container-lowest" padding="md" shadow={false}>
              <h3 className="font-headline text-lg font-bold text-on-surface">{t('activities.activitiesOwned.collections')}</h3>
              <p className="mt-2 text-sm font-semibold text-on-surface-variant">{t('activities.activitiesOwned.notInCollection')}</p>
              <MantineButton
                type="button"
                disabled
                className="mt-4"
                styles={{
                  root: {
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-outline-variant)',
                    color: 'var(--color-on-surface)',
                    fontFamily: 'var(--font-lexend)',
                    fontSize: 14,
                    fontWeight: 700,
                    minHeight: 44,
                    opacity: 1,
                  },
                }}
              >
                {t('activities.activitiesOwned.createCollection')}
              </MantineButton>
            </Card>
          </aside>
        </div>
      )}
    </section>
  )
}

function PublicLibraryHeader({ libraryCount }: { libraryCount: number }) {
  return (
    <header className="mx-auto flex max-w-[1440px] flex-col gap-4 border-b border-outline-variant bg-surface-container-lowest px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-deep">
          Bibliotecă profesor
        </p>
        <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">Activități</h1>
        <p className="text-sm font-semibold text-on-surface-variant">
          {libraryCount === 1 ? '1 activitate disponibilă' : `${libraryCount} activități disponibile`}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button href={ROUTES.TEACHER.ACTIVITY_CREATE} variant="primary" size="md">
          <Icon name="PlusCircle" size="sm" aria-hidden />
          Creează activitate
        </Button>
        <Button
          href={ROUTES.TEACHER.ASSIGNMENTS}
          variant="ghost"
          size="lg"
          className="rounded-full border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        >
          <Icon name="ClipboardText" size={18} />
          Istoric atribuiri
        </Button>
      </div>
    </header>
  )
}

function SourceTabs({
  activeTab,
  libraryCount,
  ownedActiveCount,
  libraryHref,
  ownedHref,
}: {
  activeTab: TeacherActivitiesTab
  libraryCount: number
  ownedActiveCount: number
  libraryHref: string
  ownedHref: string
}) {
  const router = useRouter()
  const tabs: Array<{
    value: TeacherActivitiesTab
    label: string
    count: number
    icon: IconName
  }> = [
    {
      value: 'library',
      label: 'Bibliotecă EduPlay',
      count: libraryCount,
      icon: 'Storefront',
    },
    {
      value: 'my',
      label: 'Activitățile mele',
      count: ownedActiveCount,
      icon: 'PencilSimple',
    },
  ]

  return (
    <div className="border-b border-outline-variant bg-surface-container-lowest px-5 py-3">
      <FilterChipGroup
        ariaLabel="Alege sursa activităților"
        items={tabs}
        value={activeTab}
        onChange={(value) =>
          router.push(tabHref(value as TeacherActivitiesTab, libraryHref, ownedHref))
        }
        radius="md"
        size="lg"
        styles={{
          root: {
            marginInline: 'auto',
            maxWidth: 1440,
          },
          chip: {
            justifyContent: 'flex-start',
          },
        }}
      />
    </div>
  )
}

export function TeacherActivitiesHub({
  activeTab,
  statusFilter,
  sortBy,
  libraryActivities,
  ownedActivities,
  libraryHref = ROUTES.TEACHER.ACTIVITIES,
  ownedHref = `${ROUTES.TEACHER.ACTIVITIES}?tab=my`,
}: TeacherActivitiesHubProps) {
  const counts = getCounts(ownedActivities)

  return (
    <div className="space-y-7">
      {activeTab === 'library' ? <PublicLibraryHeader libraryCount={libraryActivities.length} /> : null}
      <SourceTabs
        activeTab={activeTab}
        libraryCount={libraryActivities.length}
        ownedActiveCount={counts.active}
        libraryHref={libraryHref}
        ownedHref={ownedHref}
      />

      {activeTab === 'my' ? (
        <TeacherOwnedActivitiesPanel
          ownedActivities={ownedActivities}
          statusFilter={statusFilter}
          sortBy={sortBy}
          ownedHref={ownedHref}
        />
      ) : (
        <TeacherGamesPageContent games={libraryActivities} showHeader={false} />
      )}
    </div>
  )
}
