'use client'

import { useCallback, useDeferredValue, useId, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useRouter, useSearchParams } from 'next/navigation'
import { ActionIcon, Box, Button, Card, Group, Input, SimpleGrid, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { Icon } from '@/shared/components/ui/Icon'
import { FilterSelect as KitFilterSelect } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'
import classes from './TeacherDashboardContent.module.css'
import { CATEGORY_CONFIG, type Game, type GameCategory } from '@/features/games'
import type { IconName } from '@/shared/components/ui/Icon.registry'

interface TeacherLibrariesExploreContentProps {
  games: Game[]
}

type TopicTone = 'purple' | 'green' | 'blue' | 'gold' | 'pink'

interface LibraryTopic {
  label: string
  category?: GameCategory
  tone: TopicTone
  icon: IconName
}

const topics: LibraryTopic[] = [
  { label: 'all', tone: 'purple', icon: 'ListChecks' },
  { label: 'literacy', category: 'literacy', tone: 'gold', icon: CATEGORY_CONFIG.literacy.icon },
  { label: 'math', category: 'math', tone: 'blue', icon: CATEGORY_CONFIG.math.icon },
  { label: 'phonics', category: 'phonics', tone: 'purple', icon: CATEGORY_CONFIG.phonics.icon },
  { label: 'shapes', category: 'shapes', tone: 'gold', icon: CATEGORY_CONFIG.shapes.icon },
  { label: 'colors', category: 'colors', tone: 'pink', icon: CATEGORY_CONFIG.colors.icon },
  { label: 'vocabulary', category: 'vocabulary', tone: 'green', icon: CATEGORY_CONFIG.vocabulary.icon },
]

function normalizeTopic(value: string | null): GameCategory | 'all' {
  return topics.find((topic) => topic.category === value)?.category ?? 'all'
}

const PAGE_SIZE = 24
const allGradeOption = { value: 'all-grades', label: 'all' } as const
const gradeFilterDefinitions = [
  { value: 'grade-1', label: 'grade-1', minAge: 6, maxAge: 7 },
  { value: 'grade-2', label: 'grade-2', minAge: 7, maxAge: 8 },
  { value: 'grade-3', label: 'grade-3', minAge: 8, maxAge: 9 },
  { value: 'grade-4', label: 'grade-4', minAge: 9, maxAge: 10 },
] as const
const allLanguageOption = { value: 'all-languages', label: 'all' } as const
const catalogLanguageOptions = [{ value: 'ro', label: 'ro' }] as const

type GradeFilterValue = typeof allGradeOption.value | (typeof gradeFilterDefinitions)[number]['value']
type LanguageFilterValue = typeof allLanguageOption.value | (typeof catalogLanguageOptions)[number]['value']
type SelectOption = { value: string; label: string }

const surfaceInteractiveClassName = `${classes.interactive} ${classes.surfaceInteractive} teacher-libraries-interactive teacher-libraries-surface-interactive`
const actionInteractiveClassName = `${classes.interactive} ${classes.actionInteractive} teacher-libraries-interactive teacher-libraries-action-interactive`
const inputInteractiveClassName = `${surfaceInteractiveClassName} teacher-libraries-input-interactive`
const controlSurfaceInteractiveClassName = `${surfaceInteractiveClassName} ${classes.librariesControlSurface}`
const topicSurfaceInteractiveClassName = `${surfaceInteractiveClassName} ${classes.librariesTopicSurface}`
const cardSurfaceInteractiveClassName = `${surfaceInteractiveClassName} ${classes.librariesCardSurface}`
const primaryActionInteractiveClassName = `${actionInteractiveClassName} ${classes.librariesPrimaryAction}`
const floatingActionInteractiveClassName = `${actionInteractiveClassName} ${classes.librariesFloatingAction}`
const searchFormInteractiveClassName = `${inputInteractiveClassName} ${classes.librariesControlSurface}`

const toneIconStyle: Record<TopicTone, { backgroundColor: string; color: string }> = {
  purple: { backgroundColor: 'var(--color-purple-wash)', color: 'var(--color-purple-dim)' },
  green: { backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success-dim)' },
  blue: { backgroundColor: 'var(--color-blue-soft)', color: 'var(--color-blue)' },
  gold: { backgroundColor: 'var(--color-gold-soft)', color: 'var(--color-gold-deep)' },
  pink: { backgroundColor: 'var(--color-pink-soft)', color: 'var(--color-pink-deep)' },
}

function gameMeta(game: Game, t: ReturnType<typeof useTranslation>['t']) {
  if (game.target_age_min != null && game.target_age_max != null) {
    return t('libraries.explore.ages', { min: game.target_age_min, max: game.target_age_max })
  }

  if (game.estimated_duration != null) {
    return t('libraries.explore.duration', { count: game.estimated_duration })
  }

  return t('libraries.explore.activity')
}

function ageRangesOverlap(
  gameMinAge: number | null,
  gameMaxAge: number | null,
  filterMinAge: number,
  filterMaxAge: number,
) {
  if (gameMinAge == null || gameMaxAge == null) return false

  return gameMinAge <= filterMaxAge && gameMaxAge >= filterMinAge
}

function normalizeGradeFilter(value: string | null): GradeFilterValue {
  return gradeFilterDefinitions.some((option) => option.value === value)
    ? (value as GradeFilterValue)
    : allGradeOption.value
}

function normalizeLanguageFilter(value: string | null): LanguageFilterValue {
  return catalogLanguageOptions.some((option) => option.value === value)
    ? (value as LanguageFilterValue)
    : allLanguageOption.value
}

function gameMatchesGrade(game: Game, gradeFilter: GradeFilterValue) {
  if (gradeFilter === allGradeOption.value) return true

  const definition = gradeFilterDefinitions.find((option) => option.value === gradeFilter)
  if (!definition) return true

  return ageRangesOverlap(
    game.target_age_min,
    game.target_age_max,
    definition.minAge,
    definition.maxAge,
  )
}

function gameMatchesLanguage(languageFilter: LanguageFilterValue) {
  return languageFilter === allLanguageOption.value || languageFilter === 'ro'
}

function TopicIcon({ tone, icon }: { tone: TopicTone; icon: IconName }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      className={classes.librariesTopicIcon}
      style={toneIconStyle[tone]}
    >
      <Icon name={icon} size={24} weight="fill" />
    </Box>
  )
}

function TopicButton({ topic, selected, onClick }: { topic: LibraryTopic; selected: boolean; onClick: () => void }) {
  const { t } = useTranslation('teacher')
  return (
    <UnstyledButton
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        selected
          ? `${topicSurfaceInteractiveClassName} ${classes.librariesTopicButton} ${classes.librariesTopicSurfaceSelected}`
          : `${topicSurfaceInteractiveClassName} ${classes.librariesTopicButton}`
      }
    >
      <TopicIcon tone={topic.tone} icon={topic.icon} />
      <span>{t(`libraries.explore.topics.${topic.label}`)}</span>
    </UnstyledButton>
  )
}

function LibraryFilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
}) {
  return (
    <KitFilterSelect
      ariaLabel={label}
      value={value}
      options={options}
      onChange={onChange}
      className={classes.librariesFilterSelect}
      classNames={{ input: controlSurfaceInteractiveClassName }}
      size="sm"
      radius="md"
      width={160}
    />
  )
}

function ActivityCard({ game, onAssign }: { game: Game; onAssign: (activityId: string) => void }) {
  const { t } = useTranslation('teacher')
  return (
    <Card
      classNames={{ root: cardSurfaceInteractiveClassName }}
      component="article"
      aria-label={game.title}
      padding={0}
      withBorder={false}
      className={`${classes.librariesActivityCard} ${classes.librariesCardBase}`}
    >
      <Box
        component={Link}
        href={ROUTES.PLAY.ACTIVITY(game.id)}
        className={classes.librariesActivityLink}
      >
        <CardThumb category={game.category} />
        <Box component="span" className={classes.librariesCardBody}>
          <Text
            component="span"
            mb={5}
            className={classes.librariesCreator}
          >
            {t('libraries.explore.creator')}
          </Text>
          <CardTitle>{game.title}</CardTitle>
          <CardMeta>{gameMeta(game, t)}</CardMeta>
        </Box>
      </Box>
      <Tooltip label={t('libraries.explore.assign')}>
        <ActionIcon
          type="button"
          aria-label={t('libraries.explore.assignActivity', { title: game.title })}
          variant="transparent"
          onClick={() => onAssign(game.id)}
          classNames={{ root: floatingActionInteractiveClassName }}
        >
          <Icon name="UserPlus" size={20} weight="bold" aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Card>
  )
}

function CardThumb({ category }: { category: GameCategory | null }) {
  const config = category ? CATEGORY_CONFIG[category] : null
  const topic = topics.find((item) => item.category === category)
  return (
    <Box component="span" aria-hidden="true" className={classes.librariesActivityThumb}
      style={{ background: config?.bgColor ?? 'var(--color-primary-wash)', color: config?.color ?? 'var(--color-primary)' }}>
      <Icon name={topic?.icon ?? 'ListChecks'} size={44} weight="fill" aria-hidden />
    </Box>
  )
}

function CardTitle({ children }: { children: string }) {
  return <Text component="span" className={classes.librariesCardTitle}>{children}</Text>
}

function CardMeta({ children }: { children: string }) {
  return <Text component="span" className={classes.librariesCardMeta}>{children}</Text>
}

export function TeacherLibrariesExploreContent({ games }: TeacherLibrariesExploreContentProps) {
  const { t } = useTranslation('teacher')
  const router = useRouter()
  const resultsHeadingId = useId()
  const searchParams = useSearchParams()
  const [selectedTopic, setSelectedTopic] = useState<GameCategory | 'all'>(() => normalizeTopic(searchParams.get('topic')))
  const [gradeFilter, setGradeFilter] = useState<GradeFilterValue>(() =>
    normalizeGradeFilter(searchParams.get('grade')),
  )
  const [languageFilter, setLanguageFilter] = useState<LanguageFilterValue>(() =>
    normalizeLanguageFilter(searchParams.get('language')),
  )
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const deferredSearch = useDeferredValue(search)
  const selectedCategory = selectedTopic === 'all' ? undefined : selectedTopic

  const gradeOptions = useMemo<SelectOption[]>(() => {
    const availableGrades = gradeFilterDefinitions.filter((definition) =>
      games.some((game) =>
        ageRangesOverlap(
          game.target_age_min,
          game.target_age_max,
          definition.minAge,
          definition.maxAge,
        ),
      ),
    )

    return [allGradeOption, ...availableGrades].map((option) => ({ ...option, label: t(`libraries.explore.grades.${option.label}`) }))
  }, [games, t])

  const languageOptions = useMemo<SelectOption[]>(
    () => [
      allLanguageOption,
      ...(games.length > 0 ? catalogLanguageOptions : []),
    ].map((option) => ({ ...option, label: t(`libraries.explore.languages.${option.label}`) })),
    [games.length, t],
  )

  const effectiveGradeFilter = gradeOptions.some((option) => option.value === gradeFilter)
    ? gradeFilter
    : allGradeOption.value
  const effectiveLanguageFilter = languageOptions.some((option) => option.value === languageFilter)
    ? languageFilter
    : allLanguageOption.value

  const pushExploreParams = useCallback(
    (nextFilters: Partial<{ grade: GradeFilterValue; language: LanguageFilterValue; query: string; topic: GameCategory | 'all' }>) => {
      const nextGrade = nextFilters.grade ?? gradeFilter
      const nextLanguage = nextFilters.language ?? languageFilter
      const nextQuery = nextFilters.query ?? search
      const nextTopic = nextFilters.topic ?? selectedTopic
      const params = new URLSearchParams(searchParams.toString())

      if (nextGrade === allGradeOption.value) params.delete('grade')
      else params.set('grade', nextGrade)

      if (nextLanguage === allLanguageOption.value) params.delete('language')
      else params.set('language', nextLanguage)

      if (nextTopic === 'all') params.delete('topic')
      else params.set('topic', nextTopic)

      const trimmedQuery = nextQuery.trim()
      if (trimmedQuery) params.set('q', trimmedQuery)
      else params.delete('q')

      const serialized = params.toString()
      router.replace(serialized ? `${ROUTES.TEACHER.LIBRARIES_EXPLORE}?${serialized}` : ROUTES.TEACHER.LIBRARIES_EXPLORE, {
        scroll: false,
      })
    },
    [gradeFilter, languageFilter, router, search, searchParams, selectedTopic],
  )

  const handleGradeChange = (value: string) => {
    const nextGrade = normalizeGradeFilter(value)
    setVisibleCount(PAGE_SIZE)
    setGradeFilter(nextGrade)
    pushExploreParams({ grade: nextGrade })
  }

  const handleLanguageChange = (value: string) => {
    const nextLanguage = normalizeLanguageFilter(value)
    setVisibleCount(PAGE_SIZE)
    setLanguageFilter(nextLanguage)
    pushExploreParams({ language: nextLanguage })
  }

  const handleTopicChange = (topic: GameCategory | 'all') => {
    setVisibleCount(PAGE_SIZE)
    setSelectedTopic(topic)
    pushExploreParams({ topic })
  }

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault()
    pushExploreParams({ query: search })
  }

  const filteredGames = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase('ro-RO')

    return games.filter((game) => {
      if (selectedCategory && game.category !== selectedCategory) return false
      if (!gameMatchesGrade(game, effectiveGradeFilter)) return false
      if (!gameMatchesLanguage(effectiveLanguageFilter)) return false
      if (!query) return true

      return (
        game.title.toLocaleLowerCase('ro-RO').includes(query) ||
        game.description?.toLocaleLowerCase('ro-RO').includes(query) ||
        game.category?.toLocaleLowerCase('ro-RO').includes(query)
      )
    })
  }, [deferredSearch, effectiveGradeFilter, effectiveLanguageFilter, games, selectedCategory])

  const visibleGames = filteredGames.slice(0, visibleCount)

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

  return (
    <Box
      component="div"
      data-testid="library-explore-content"
      bg="var(--color-surface)"
      c="var(--color-on-surface)"
      className={`${classes.teacherScrollPage} teacher-scroll-page`}
    >
      <Stack gap={0} className={classes.librariesColumn}>
        <Stack align="center" gap={8} className={classes.librariesSearchBlock}>
          <Box component="h2" className={classes.librariesHeading}>
            {t('libraries.explore.searchHeading')}
          </Box>
          <Group
            component="form"
            role="search"
            gap={0}
            wrap="nowrap"
            onSubmit={handleSearchSubmit}
            className={searchFormInteractiveClassName}
            style={{ width: 'min(796px, 100%)' }}
          >
            <Input
              id="libraries-search"
              type="search"
              value={search}
              onChange={(event) => { setVisibleCount(PAGE_SIZE); setSearch(event.currentTarget.value) }}
              placeholder={t('libraries.explore.search')}
              aria-label={t('libraries.explore.search')}
              variant="unstyled"
              style={{ flex: 1 }}
              styles={{
                input: {
                  minHeight: 44,
                  padding: '9px 12px',
                  color: 'var(--color-on-surface)',
                  fontSize: 'var(--mantine-font-size-md)',
                },
              }}
            />
            <ActionIcon
              classNames={{ root: primaryActionInteractiveClassName }}
              type="submit"
              aria-label={t('libraries.explore.search')}
              variant="transparent"
              className={classes.librariesSearchButton}
            >
              <Icon name="MagnifyingGlass" size={22} weight="bold" aria-hidden />
            </ActionIcon>
          </Group>
        </Stack>

        <SimpleGrid aria-label={t('libraries.explore.topicsLabel')} className={classes.librariesTopicGrid}>
          {topics.filter((topic) => !topic.category || games.some((game) => game.category === topic.category)).map((topic) => (
            <TopicButton
              key={topic.label}
              topic={topic}
              selected={selectedTopic === (topic.category ?? 'all')}
              onClick={() => handleTopicChange(topic.category ?? 'all')}
            />
          ))}
        </SimpleGrid>

        <Group aria-label={t('libraries.explore.filtersLabel')} gap={12} align="center" className={classes.librariesFilterRow}>
          <LibraryFilterSelect
            label={t('libraries.explore.grades.all')}
            value={effectiveGradeFilter}
            options={gradeOptions}
            onChange={handleGradeChange}
          />
          <LibraryFilterSelect
            label={t('libraries.explore.languages.all')}
            value={effectiveLanguageFilter}
            options={languageOptions}
            onChange={handleLanguageChange}
          />
        </Group>

        <Box component="section" aria-labelledby={resultsHeadingId} style={{ marginTop: 37 }}>
          <Box component="h2" id={resultsHeadingId} className={classes.librariesSectionHeading}>
            {t('libraries.explore.resultsHeading')}
          </Box>
          <Text mb="sm">{t('libraries.explore.results', { count: filteredGames.length, shown: visibleGames.length, total: filteredGames.length })}</Text>
          {visibleGames.length > 0 ? (
            <SimpleGrid spacing={16} verticalSpacing={24} cols={{ base: 1, sm: 2, md: 3, lg: 4 }}>
              {visibleGames.map((game) => (
                <ActivityCard
                  key={game.id}
                  game={game}
                  onAssign={handleAssign}
                />
              ))}
            </SimpleGrid>
          ) : (
            <Text
              p={24}
              className={classes.librariesEmpty}
            >
              {t('libraries.explore.empty')}
            </Text>
          )}
          {visibleCount < filteredGames.length && <Button mt="md" variant="default" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>{t('libraries.explore.showMore')}</Button>}
        </Box>
      </Stack>
    </Box>
  )
}
