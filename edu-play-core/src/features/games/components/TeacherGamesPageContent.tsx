'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { Button as MantineButton, TextInput } from '@mantine/core'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/Icon'
import {
  Button as KitButton,
  FilterChipGroup,
  FilterSelect,
  type FilterChipOption,
} from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'
import { TeacherGameCard } from './TeacherGameCard'
import { ALL_CATEGORIES, getCategoryConfig, type Game, type GameCategory } from '../types'

const ACTIVITIES_PER_PAGE = 8

interface TeacherGamesPageContentProps {
  games: Game[]
  searchQuery?: string
  showHeader?: boolean
}

const FEATURED_LIMIT = 3

const SORT_OPTIONS = [
  { value: 'newest', labelKey: 'activities.sort.newest' },
  { value: 'difficulty', labelKey: 'activities.sort.difficulty' },
  { value: 'age', labelKey: 'activities.sort.age' },
] as const


export function TeacherGamesPageContent({
  games,
  searchQuery = '',
  showHeader = true,
}: TeacherGamesPageContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation('teacher')
  const [selectedCategory, setSelectedCategory] = useState<GameCategory | 'all'>('all')
  const [sortBy, setSortBy] = useState('newest')
  const [search, setSearch] = useState(searchQuery)
  const [visibleCount, setVisibleCount] = useState(ACTIVITIES_PER_PAGE)
  const deferredSearch = useDeferredValue(search)

  const filteredGames = useMemo(() => {
    let result = games
    const query = deferredSearch.trim().toLowerCase()

    if (query) {
      result = result.filter(
        (game) =>
          game.title.toLowerCase().includes(query) ||
          game.description?.toLowerCase().includes(query) ||
          game.category?.toLowerCase().includes(query),
      )
    }

    if (selectedCategory !== 'all') {
      result = result.filter((game) => game.category === selectedCategory)
    }

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'difficulty':
          return (a.difficulty_level ?? 0) - (b.difficulty_level ?? 0)
        case 'age':
          return (a.target_age_min ?? 0) - (b.target_age_min ?? 0)
        case 'newest':
        default:
          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      }
    })
  }, [games, deferredSearch, selectedCategory, sortBy])

  const visibleGames = filteredGames.slice(0, visibleCount)
  const hasMore = visibleCount < filteredGames.length
  const categoryCounts = useMemo(() => {
    const counts = new Map<GameCategory, number>()

    for (const category of ALL_CATEGORIES) {
      counts.set(category, 0)
    }

    for (const game of games) {
      if (game.category) {
        counts.set(game.category, (counts.get(game.category) ?? 0) + 1)
      }
    }

    return counts
  }, [games])

  const categoryOptions = useMemo<FilterChipOption[]>(
    () => [
      {
        value: 'all',
        label: t('activities.library.allSubjects'),
        count: games.length,
      },
      ...ALL_CATEGORIES.map((category) => {
        const item = getCategoryConfig(category)

        return {
          value: category,
          label: t(`activities.filters.categories.${category}`),
          count: categoryCounts.get(category) ?? 0,
          icon: item.icon,
        }
      }),
    ],
    [categoryCounts, games.length, t],
  )

  const sourceOptions = useMemo<FilterChipOption[]>(
    () => [
      {
        value: 'seesaw',
        label: t('activities.library.seesawLibrary'),
      },
      {
        value: 'community',
        label: t('activities.library.communityLibrary'),
        disabled: true,
      },
    ],
    [t],
  )

  const handleCategoryChange = (category: GameCategory | 'all') => {
    setSelectedCategory(category)
    setVisibleCount(ACTIVITIES_PER_PAGE)
  }

  const handleSortChange = (sort: string) => {
    setSortBy(sort)
    setVisibleCount(ACTIVITIES_PER_PAGE)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setVisibleCount(ACTIVITIES_PER_PAGE)
  }

  const handleAssign = (activityId: string) => {
    const params = new URLSearchParams()
    params.set('activityId', activityId)

    const assignTo = searchParams.get('assignTo')
    const studentId = searchParams.get('studentId')
    const classId = searchParams.get('classId')

    if (assignTo) params.set('assignTo', assignTo)
    if (studentId) params.set('studentId', studentId)
    if (classId) params.set('classId', classId)

    router.push(`${ROUTES.TEACHER.ASSIGNMENT_NEW}?${params.toString()}`)
  }

  const featuredGames = filteredGames.slice(0, FEATURED_LIMIT)
  const publicGames = visibleGames.filter((game) => !featuredGames.some((featured) => featured.id === game.id))

  return (
    <div className="mx-auto max-w-[1440px] space-y-7">
      {showHeader ? (
        <header className="flex flex-col gap-4 border-b border-outline-variant bg-surface-container-lowest px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-deep">
              {t('activities.eyebrow')}
            </p>
            <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">
              {t('activities.title')}
            </h1>
            <p className="text-sm font-semibold text-on-surface-variant">
              {t('activities.availableCount', { count: games.length })}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <KitButton
              href={ROUTES.TEACHER.ACTIVITY_CREATE}
              variant="primary"
              size="md"
            >
              <Icon name="PlusCircle" size="sm" aria-hidden />
              {t('activities.createActivity')}
            </KitButton>
            <MantineButton
              component={Link}
              href={ROUTES.TEACHER.ASSIGNMENTS}
              leftSection={<Icon name="ClipboardText" size={18} aria-hidden />}
              radius="xl"
              size="md"
              styles={{
                root: {
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-outline-variant)',
                  color: 'var(--color-on-surface-variant)',
                  fontWeight: 700,
                  minHeight: '3rem',
                },
              }}
              variant="default"
            >
              {t('activities.assignmentHistory')}
            </MantineButton>
          </div>
        </header>
      ) : null}


      <section className="space-y-6 px-0" aria-labelledby="library-explore-heading">
        <div className="space-y-5 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-soft-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 id="library-explore-heading" className="text-xl font-bold text-on-surface">
                {t('activities.library.exploreTitle')}
              </h2>
              <p className="mt-1 text-sm font-semibold text-on-surface-variant">
                {t('activities.library.exploreDescription')}
              </p>
              <FilterChipGroup
                ariaLabel={t('activities.library.exploreTitle')}
                className="mt-4"
                items={sourceOptions}
                onChange={() => undefined}
                value="seesaw"
              />
            </div>
            <TextInput
              aria-label={t('activities.search.label')}
              className="min-w-0 lg:w-[420px]"
              leftSection={<Icon name="MagnifyingGlass" size={18} aria-hidden />}
              leftSectionPointerEvents="none"
              onChange={(event) => handleSearchChange(event.currentTarget.value)}
              placeholder={t('activities.library.searchPlaceholder')}
              radius="xl"
              size="md"
              styles={{
                input: {
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-outline-variant)',
                  color: 'var(--color-on-surface)',
                  fontWeight: 600,
                  minHeight: '3rem',
                },
                section: {
                  color: 'var(--color-on-surface-variant)',
                },
              }}
              type="search"
              value={search}
            />
          </div>

          <FilterChipGroup
            ariaLabel={t('activities.filters.categoriesLabel')}
            items={categoryOptions}
            onChange={(category) => handleCategoryChange(category as GameCategory | 'all')}
            radius="lg"
            size="lg"
            value={selectedCategory}
          />
          <div className="flex flex-wrap items-center gap-3">
            <FilterSelect
              ariaLabel={t('activities.library.selectGrade')}
              disabled
              onChange={() => undefined}
              options={[{ value: 'all-grades', label: t('activities.library.selectGrade') }]}
              radius="md"
              size="sm"
              value="all-grades"
              width={180}
            />
            <FilterSelect
              ariaLabel={t('activities.library.language')}
              disabled
              onChange={() => undefined}
              options={[{ value: 'all-languages', label: t('activities.library.language') }]}
              radius="md"
              size="sm"
              value="all-languages"
              width={132}
            />
            <FilterSelect
              ariaLabel={t('activities.library.browseStandards')}
              disabled
              onChange={() => undefined}
              options={[{ value: 'standards', label: t('activities.library.browseStandards') }]}
              radius="md"
              size="sm"
              value="standards"
              width={276}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <FilterSelect
              label={t('activities.sort.label')}
              value={sortBy}
              onChange={handleSortChange}
              options={SORT_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              size="sm"
              radius="md"
              width={176}
            />
            <span className="ml-auto text-sm font-bold text-on-surface-variant">
              {t('activities.filteredCount', { count: filteredGames.length })}
            </span>
          </div>
        </div>

        {filteredGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest py-16 text-center">
            <Icon name="BookOpen" size={64} className="mb-4 text-outline-variant" />
            <h3 className="mb-2 text-lg font-semibold text-on-surface-variant">
              {games.length === 0
                ? t('activities.empty.noActivities')
                : t('activities.empty.noResults')}
            </h3>
            <p className="text-outline">
              {games.length === 0
                ? t('activities.empty.noActivitiesBody')
                : t('activities.empty.noResultsBody')}
            </p>
          </div>
        ) : (
          <>
            {featuredGames.length > 0 ? (
              <section className="space-y-3" aria-labelledby="featured-library-heading">
                <h2 id="featured-library-heading" className="text-xl font-bold text-on-surface">
                  {t('activities.library.featuredTitle')}
                </h2>
                <div className="grid gap-4 md:grid-cols-3">
                  {featuredGames.map((game) => (
                    <TeacherGameCard key={game.id} game={game} onAssign={handleAssign} featured />
                  ))}
                </div>
              </section>
            ) : null}

            {publicGames.length > 0 ? (
              <section className="space-y-3" aria-labelledby="public-library-heading">
                <h2 id="public-library-heading" className="text-xl font-bold text-on-surface">
                  {t('activities.library.popularTitle')}
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {publicGames.map((game) => (
                    <TeacherGameCard key={game.id} game={game} onAssign={handleAssign} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </section>

      {hasMore && (
        <div className="flex justify-center py-10">
          <MantineButton
            rightSection={<Icon name="CaretDoubleDown" aria-hidden />}
            onClick={() => setVisibleCount((prev) => prev + ACTIVITIES_PER_PAGE)}
            radius="xl"
            size="md"
            styles={{
              root: {
                color: 'var(--color-on-surface-variant)',
                fontWeight: 800,
                minHeight: '3rem',
              },
            }}
            variant="subtle"
          >
            {t('activities.loadMore')}
          </MantineButton>
        </div>
      )}
    </div>
  )
}
