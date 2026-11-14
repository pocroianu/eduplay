'use client'

import { useCallback, useDeferredValue, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ActionIcon, Box, Card, Group, Input, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import { Icon } from '@/shared/components/ui/Icon'
import { FilterSelect as KitFilterSelect } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'
import classes from './TeacherDashboardContent.module.css'
import type { Game, GameCategory } from '@/features/games'

interface TeacherLibrariesExploreContentProps {
  games: Game[]
}

type TopicTone = 'purple' | 'green' | 'blue' | 'gold' | 'pink'

interface LibraryTopic {
  label: string
  category?: GameCategory
  tone: TopicTone
}

interface FeaturedCollection {
  href: string
  title: string
  meta: string
  tone: TopicTone
}

const topics: LibraryTopic[] = [
  { label: 'Esențiale EduPlay', tone: 'purple' },
  { label: 'Evaluări', tone: 'green' },
  { label: 'Șabloane și portofolii', tone: 'blue' },
  { label: 'Literație timpurie', category: 'literacy', tone: 'gold' },
  { label: 'Literație AI', tone: 'pink' },
  { label: 'Rutine zilnice', tone: 'purple' },
  { label: 'Matematică', category: 'math', tone: 'blue' },
  { label: 'Limba română', category: 'phonics', tone: 'green' },
  { label: 'Caracter', tone: 'gold' },
  { label: 'Științe', tone: 'pink' },
]

const featuredCollections: FeaturedCollection[] = [
  {
    href: `${ROUTES.TEACHER.LIBRARIES_EXPLORE}?collection=dailies`,
    title: 'Rutine zilnice de clasă',
    meta: '98 de lecții',
    tone: 'purple',
  },
  {
    href: `${ROUTES.TEACHER.LIBRARIES_EXPLORE}?collection=summer`,
    title: 'Învățare de vară',
    meta: '48 de lecții',
    tone: 'gold',
  },
  {
    href: `${ROUTES.TEACHER.LIBRARIES_EXPLORE}?collection=reading`,
    title: 'Îmi place să citesc',
    meta: '24 de lecții',
    tone: 'green',
  },
]

const allGradeOption = { value: 'all-grades', label: 'Alege clasa' } as const
const gradeFilterDefinitions = [
  { value: 'grade-1', label: 'Clasa I', minAge: 6, maxAge: 7 },
  { value: 'grade-2', label: 'Clasa a II-a', minAge: 7, maxAge: 8 },
  { value: 'grade-3', label: 'Clasa a III-a', minAge: 8, maxAge: 9 },
  { value: 'grade-4', label: 'Clasa a IV-a', minAge: 9, maxAge: 10 },
] as const
const allLanguageOption = { value: 'all-languages', label: 'Alege limba' } as const
const catalogLanguageOptions = [{ value: 'ro', label: 'Română' }] as const

const cardTones: TopicTone[] = ['purple', 'green', 'blue', 'gold', 'pink']

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

const thumbStyle: Record<TopicTone, string> = {
  purple: 'linear-gradient(135deg, var(--color-purple-dim) 0%, var(--color-purple) 100%)',
  green: 'linear-gradient(135deg, var(--color-primary-wash) 0%, var(--color-tertiary-container) 100%)',
  blue: 'linear-gradient(135deg, var(--color-blue-wash) 0%, var(--color-blue-dim) 100%)',
  gold: 'linear-gradient(135deg, var(--color-gold-soft) 0%, var(--color-gold) 100%)',
  pink: 'linear-gradient(135deg, var(--color-pink-soft) 0%, var(--color-pink) 100%)',
}

const searchHeadingStyle = {
  color: 'var(--color-on-surface)',
  fontSize: 20,
  fontWeight: 700,
  lineHeight: '30px',
  margin: 0,
} as const

const searchButtonStyle = {
  width: 44,
  height: 44,
  marginRight: 4,
  borderRadius: 4,
} as const

const sectionStyle = {
  marginTop: 38,
} as const

const sectionHeadingStyle = {
  margin: '0 0 16px',
  color: 'var(--color-on-surface)',
  fontSize: 20,
  fontWeight: 700,
  lineHeight: '30px',
} as const

const cardBaseStyle = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 12,
} as const

const cardBodyStyle = {
  display: 'flex',
  minWidth: 0,
  flex: 1,
  flexDirection: 'column',
} as const

function gameMeta(game: Game) {
  if (game.target_age_min != null && game.target_age_max != null) {
    return `Vârste ${game.target_age_min}-${game.target_age_max}`
  }

  if (game.estimated_duration != null) {
    return `${game.estimated_duration} min`
  }

  return 'Activitate EduPlay'
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

function gradeHeading(gradeFilter: GradeFilterValue) {
  if (gradeFilter === allGradeOption.value) return 'Cele mai populare activități'

  const definition = gradeFilterDefinitions.find((option) => option.value === gradeFilter)
  return definition
    ? `Cele mai populare activități pentru ${definition.label.toLocaleLowerCase('ro-RO')}`
    : 'Cele mai populare activități'
}

function TopicIcon({ tone }: { tone: TopicTone }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        ...toneIconStyle[tone],
      }}
    >
      <Icon name="BookOpen" size={24} weight="fill" />
    </Box>
  )
}

function TopicButton({ topic, selected, onClick }: { topic: LibraryTopic; selected: boolean; onClick: () => void }) {
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
      style={{
        fontSize: 14,
        fontWeight: 700,
        lineHeight: '17px',
        textAlign: 'center',
      }}
    >
      <TopicIcon tone={topic.tone} />
      <span>{topic.label}</span>
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

function CollectionCard({ href, title, meta, tone }: FeaturedCollection) {
  return (
    <Card
      component={Link}
      href={href}
      aria-label={`${title}, ${meta}`}
      classNames={{ root: cardSurfaceInteractiveClassName }}
      padding={0}
      withBorder={false}
      className={classes.librariesCollectionCard}
      style={{
        ...cardBaseStyle,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <CardThumb tone={tone} collection />
      <Box
        component="span"
        style={{ ...cardBodyStyle, justifyContent: 'center', padding: 14 }}
      >
        <CardTitle collection>{title}</CardTitle>
        <CardMeta>{meta}</CardMeta>
      </Box>
    </Card>
  )
}

function ActivityCard({ game, tone, onAssign }: { game: Game; tone: TopicTone; onAssign: (activityId: string) => void }) {
  return (
    <Card
      classNames={{ root: cardSurfaceInteractiveClassName }}
      component="article"
      aria-label={game.title}
      padding={0}
      withBorder={false}
      className={classes.librariesActivityCard}
      style={cardBaseStyle}
    >
      <Box
        component={Link}
        href={ROUTES.PLAY.ACTIVITY(game.id)}
        style={{
          display: 'flex',
          minHeight: 233,
          flexDirection: 'column',
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        <CardThumb tone={tone} />
        <Box component="span" style={{ ...cardBodyStyle, padding: '10px 12px 12px' }}>
          <Text
            component="span"
            mb={5}
            style={{
              color: 'var(--color-on-surface-variant)',
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 1.25,
            }}
          >
            Biblioteca EduPlay
          </Text>
          <CardTitle>{game.title}</CardTitle>
          <CardMeta>{gameMeta(game)}</CardMeta>
        </Box>
      </Box>
      <ActionIcon
        type="button"
        aria-label={`Atribuie activitatea ${game.title}`}
        variant="transparent"
        onClick={() => onAssign(game.id)}
        classNames={{ root: floatingActionInteractiveClassName }}
        style={{
          position: 'absolute',
          right: 10,
          top: 10,
          width: 36,
          height: 36,
          borderRadius: 10,
        }}
      >
        <Icon name="Star" size={20} weight="regular" aria-hidden />
      </ActionIcon>
    </Card>
  )
}

function CardThumb({ tone, collection = false }: { tone: TopicTone; collection?: boolean }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      className={collection ? classes.librariesCollectionThumb : classes.librariesActivityThumb}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: thumbStyle[tone],
      }}
    >
      <Box
        component="span"
        style={{
          display: 'inline-flex',
          width: 64,
          height: 64,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 16,
          backgroundColor: 'color-mix(in oklab, var(--color-surface-container-lowest) 88%, transparent)',
          color: 'var(--color-purple-dim)',
          boxShadow: 'var(--shadow-soft-sm)',
        }}
      >
        <Icon name="BookOpen" size={44} weight="fill" aria-hidden />
      </Box>
    </Box>
  )
}

function CardTitle({ children, collection = false }: { children: string; collection?: boolean }) {
  return (
    <Text
      component="span"
      style={{
        display: '-webkit-box',
        overflow: 'hidden',
        color: 'var(--color-on-surface)',
        fontSize: collection ? 17 : 15,
        fontWeight: 700,
        lineHeight: 1.35,
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: collection ? 2 : 3,
      }}
    >
      {children}
    </Text>
  )
}

function CardMeta({ children }: { children: string }) {
  return (
    <Text component="span" mt="auto" pt={8} style={{ color: 'var(--color-on-surface-variant)', fontSize: 12, fontWeight: 700 }}>
      {children}
    </Text>
  )
}

export function TeacherLibrariesExploreContent({ games }: TeacherLibrariesExploreContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedTopic, setSelectedTopic] = useState(0)
  const [gradeFilter, setGradeFilter] = useState<GradeFilterValue>(() =>
    normalizeGradeFilter(searchParams.get('grade')),
  )
  const [languageFilter, setLanguageFilter] = useState<LanguageFilterValue>(() =>
    normalizeLanguageFilter(searchParams.get('language')),
  )
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const deferredSearch = useDeferredValue(search)
  const selectedCategory = topics[selectedTopic]?.category

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

    return [allGradeOption, ...availableGrades]
  }, [games])

  const languageOptions = useMemo<SelectOption[]>(
    () => [
      allLanguageOption,
      ...(games.length > 0 ? catalogLanguageOptions : []),
    ],
    [games.length],
  )

  const effectiveGradeFilter = gradeOptions.some((option) => option.value === gradeFilter)
    ? gradeFilter
    : allGradeOption.value
  const effectiveLanguageFilter = languageOptions.some((option) => option.value === languageFilter)
    ? languageFilter
    : allLanguageOption.value

  const pushExploreParams = useCallback(
    (nextFilters: Partial<{ grade: GradeFilterValue; language: LanguageFilterValue; query: string }>) => {
      const nextGrade = nextFilters.grade ?? gradeFilter
      const nextLanguage = nextFilters.language ?? languageFilter
      const nextQuery = nextFilters.query ?? search
      const params = new URLSearchParams(searchParams.toString())

      if (nextGrade === allGradeOption.value) params.delete('grade')
      else params.set('grade', nextGrade)

      if (nextLanguage === allLanguageOption.value) params.delete('language')
      else params.set('language', nextLanguage)

      const trimmedQuery = nextQuery.trim()
      if (trimmedQuery) params.set('q', trimmedQuery)
      else params.delete('q')

      const serialized = params.toString()
      router.push(serialized ? `${ROUTES.TEACHER.LIBRARIES_EXPLORE}?${serialized}` : ROUTES.TEACHER.LIBRARIES_EXPLORE, {
        scroll: false,
      })
    },
    [gradeFilter, languageFilter, router, search, searchParams],
  )

  const handleGradeChange = (value: string) => {
    const nextGrade = normalizeGradeFilter(value)
    setGradeFilter(nextGrade)
    pushExploreParams({ grade: nextGrade })
  }

  const handleLanguageChange = (value: string) => {
    const nextLanguage = normalizeLanguageFilter(value)
    setLanguageFilter(nextLanguage)
    pushExploreParams({ language: nextLanguage })
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

  const visibleGames = filteredGames.slice(0, 24)

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
      component="main"
      aria-label="Explorează biblioteci"
      h="calc(100vh - 98px)"
      mih={0}
      bg="var(--color-surface)"
      c="var(--color-on-surface)"
      className={classes.librariesPage}
    >
      <Stack component="section" aria-label="Conținut biblioteci" gap={0} className={classes.librariesColumn}>
        <Stack align="center" gap={8} className={classes.librariesSearchBlock}>
          <Box component="h2" style={searchHeadingStyle}>
            Ce vrei să predai?
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
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Caută"
              aria-label="Caută"
              variant="unstyled"
              style={{ flex: 1 }}
              styles={{
                input: {
                  minHeight: 44,
                  padding: '9px 12px',
                  color: 'var(--color-on-surface)',
                  fontSize: 16,
                },
              }}
            />
            <ActionIcon
              classNames={{ root: primaryActionInteractiveClassName }}
              type="submit"
              aria-label="Caută"
              variant="transparent"
              style={searchButtonStyle}
            >
              <Icon name="MagnifyingGlass" size={22} weight="bold" aria-hidden />
            </ActionIcon>
          </Group>
        </Stack>

        <SimpleGrid aria-label="Subiecte bibliotecă" className={classes.librariesTopicGrid}>
          {topics.map((topic, index) => (
            <TopicButton
              key={topic.label}
              topic={topic}
              selected={selectedTopic === index}
              onClick={() => setSelectedTopic(index)}
            />
          ))}
        </SimpleGrid>

        <Group aria-label="Filtre bibliotecă" gap={12} align="center" className={classes.librariesFilterRow}>
          <LibraryFilterSelect
            label="Alege clasa"
            value={effectiveGradeFilter}
            options={gradeOptions}
            onChange={handleGradeChange}
          />
          <LibraryFilterSelect
            label="Alege limba"
            value={effectiveLanguageFilter}
            options={languageOptions}
            onChange={handleLanguageChange}
          />
          <Box
            component="span"
            className={classes.librariesCurriculumBadge}
            style={{
              display: 'inline-flex',
              minHeight: 36,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              border: '1px solid var(--color-outline-variant)',
              borderRadius: 8,
              padding: '0 12px',
              backgroundColor: 'var(--color-surface-container-lowest)',
              boxShadow: 'var(--shadow-soft-sm)',
              color: 'var(--color-on-surface-variant)',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <Icon name="ListChecks" size={16} weight="bold" aria-hidden />
            Standarde și curriculum EduPlay
          </Box>
        </Group>

        <Box component="section" aria-label="Colecții recomandate" style={sectionStyle}>
          <Box component="h2" style={sectionHeadingStyle}>
            Colecții recomandate
          </Box>
          <SimpleGrid spacing={16} cols={{ base: 1, sm: 2, md: 3 }}>
            {featuredCollections.map((collection) => (
              <CollectionCard key={collection.title} {...collection} />
            ))}
          </SimpleGrid>
        </Box>

        <Box component="section" aria-label="Cele mai populare activități" style={{ marginTop: 37 }}>
          <Box component="h2" style={sectionHeadingStyle}>
            {gradeHeading(effectiveGradeFilter)}
          </Box>
          {visibleGames.length > 0 ? (
            <SimpleGrid spacing={16} verticalSpacing={24} cols={{ base: 1, sm: 2, md: 3, lg: 4 }}>
              {visibleGames.map((game, index) => (
                <ActivityCard
                  key={game.id}
                  game={game}
                  tone={cardTones[index % cardTones.length]}
                  onAssign={handleAssign}
                />
              ))}
            </SimpleGrid>
          ) : (
            <Text
              p={24}
              style={{
                border: '1px solid var(--color-outline)',
                borderRadius: 8,
                backgroundColor: 'var(--color-surface-container-lowest)',
                color: 'var(--color-on-surface-variant)',
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Nu am găsit activități pentru filtrul ales.
            </Text>
          )}
        </Box>
      </Stack>
    </Box>
  )
}
