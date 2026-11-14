'use client'

import {
  ActionIcon,
  Anchor,
  Avatar,
  Box,
  Button,
  Card,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { ROUTES } from '@/shared/lib/constants'
import classes from './TeacherDashboardContent.module.css'

export interface TeacherDashboardContentProps {
  profile: {
    id: string
    full_name: string
    email: string
    role: string
    avatar_url?: string | null
  }
  stats: {
    studentCount: number
    classCount: number
    gameCount: number
  }
  classes: Array<{
    id: string
    name: string
    grade_level: string | null
    is_active: boolean
  }>
  countByClass: Record<string, number>
  studentSummaries: Array<{
    id: string
    name: string
    avatarUrl: string | null
    className: string | null
    completedGames: number
    inProgressGames: number
    totalGames: number
    averageScore: number
    lastActivityAt: string | null
    focusArea: string
  }>
  recentActivity: Array<{
    id: string
    studentName: string
    studentAvatarUrl: string | null
    gameTitle: string
    timestamp: string | null
    score: number | null
    status: string
  }>
  weeklyActivity: Array<{
    label: string
    count: number
    dateLabel: string
  }>
  subjectSnapshot: Array<{
    label: string
    value: number
    note: string
    color: string
  }>
}

type ActionTone = 'journal' | 'purple'
type ThumbnailTone = 'green' | 'pink' | 'gold' | 'blue'

interface HomeAction {
  href: string
  icon: IconName
  title: string
  subtitle: string
  tone: ActionTone
}

interface LibraryCard {
  href: string
  title: string
  creator: string
  meta: string
  imageAlt: string
  tone: ThumbnailTone
  count: number
}

interface TeacherResource {
  href: string
  title: string
  meta: string
  icon: IconName
}

type TeacherClass = TeacherDashboardContentProps['classes'][number]

interface TeacherClassCardProps {
  classItem: TeacherClass
  studentCountLabel: string
}

interface EmptyClassesCardProps {
  title: string
  body: string
  actionLabel: string
}

const pageStyle = {
  height: 'calc(100vh - 68px)',
  minHeight: 0,
  overflowY: 'auto',
} as const

const columnStyle = {
  width: 'min(1520px, calc(100% - 48px))',
  marginInline: 'auto',
} as const

const paperStyle = {
  backgroundColor: 'var(--color-surface-container-lowest)',
  color: 'var(--color-on-surface)',
} as const

const borderedCardStyle = {
  borderColor: 'var(--color-outline)',
  color: 'var(--color-on-surface)',
  textDecoration: 'none',
} as const

const actionToneBackground: Record<ActionTone, string> = {
  journal: 'var(--color-success-journal)',
  purple: 'var(--color-purple-dim)',
}

const thumbnailBackground: Record<ThumbnailTone, string> = {
  green: 'linear-gradient(135deg, var(--color-primary-wash) 0%, var(--color-tertiary-container) 100%)',
  pink: 'linear-gradient(135deg, var(--color-gold-soft) 0%, var(--color-pink) 100%)',
  gold: 'linear-gradient(135deg, var(--color-gold-soft) 0%, var(--color-purple-wash) 100%)',
  blue: 'linear-gradient(135deg, var(--color-blue-wash) 0%, var(--color-blue-dim) 100%)',
}

const actionButtonStyles = {
  root: {
    minHeight: 108,
    padding: '22px 24px',
    whiteSpace: 'normal',
  },
  inner: {
    justifyContent: 'flex-start',
  },
  section: {
    marginInlineEnd: 16,
  },
} as const

const clampedTitleStyle = {
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
} as const

const thumbnailTileStyle = {
  position: 'absolute',
  display: 'block',
  borderRadius: 6,
  backgroundColor: 'color-mix(in oklab, var(--color-surface-container-lowest) 82%, transparent)',
  boxShadow: 'var(--shadow-soft-sm)',
} as const

const thumbnailTiles = [
  { key: 'left-top', left: 16, top: 20, width: 42, height: 28 },
  { key: 'right-top', right: 18, top: 26, width: 58, height: 36 },
  { key: 'left-bottom', left: 58, bottom: 16, width: 76, height: 24 },
] as const

const surfaceInteractiveClassName = `${classes.interactive} ${classes.surfaceInteractive} teacher-home-interactive teacher-home-surface-interactive`
const actionInteractiveClassName = `${classes.interactive} ${classes.actionInteractive} teacher-home-interactive teacher-home-action-interactive`
const inputInteractiveClassName = `${surfaceInteractiveClassName} teacher-home-input-interactive`

function initials(value: string) {
  return (
    value
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase('ro-RO') ?? '')
      .join('') || '?'
  )
}

function TeacherHomePanel({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Paper
      component="section"
      aria-label={label}
      radius={8}
      p={{ base: 16, sm: 20, md: 36 }}
      style={paperStyle}
    >
      {children}
    </Paper>
  )
}

function TeacherHomeActionCard({ href, icon, title, subtitle, tone }: HomeAction) {
  return (
    <Button
      component={Link}
      href={href}
      fullWidth
      classNames={{ root: actionInteractiveClassName }}
      radius={8}
      variant="filled"
      justify="flex-start"
      leftSection={
        <ThemeIcon
          size={44}
          radius="md"
          variant="transparent"
          c="var(--color-on-primary)"
          aria-hidden="true"
        >
          <Icon name={icon} size={32} weight="fill" aria-hidden />
        </ThemeIcon>
      }
      styles={actionButtonStyles}
      style={{
        backgroundColor: actionToneBackground[tone],
        color: 'var(--color-on-primary)',
      }}
    >
      <Stack gap={4} align="flex-start">
        <Text span size="sm" fw={800} lh={1.15} c="inherit">
          {title}
        </Text>
        <Text
          span
          size="xs"
          fw={700}
          lh={1.25}
          c="color-mix(in oklab, var(--color-on-primary) 90%, transparent)"
        >
          {subtitle}
        </Text>
      </Stack>
    </Button>
  )
}

function CommunityActivityCard({ href, title, creator, meta, imageAlt, tone, count }: LibraryCard) {
  return (
    <Card
      component={Link}
      href={href}
      withBorder
      classNames={{ root: surfaceInteractiveClassName }}
      radius={8}
      shadow="xs"
      padding="sm"
      aria-label={`${title} · ${creator}`}
      style={{ ...borderedCardStyle, minHeight: 264 }}
    >
      <Card.Section>
        <Box
          role="img"
          aria-label={imageAlt}
          pos="relative"
          h={118}
          style={{
            overflow: 'hidden',
            background: thumbnailBackground[tone],
          }}
        >
          {thumbnailTiles.map(({ key, ...tileStyle }) => (
            <Box key={key} style={{ ...thumbnailTileStyle, ...tileStyle }} />
          ))}
        </Box>
      </Card.Section>

      <Group gap={8} mt="sm" wrap="nowrap">
        <Avatar
          size={24}
          radius="xl"
          color="gray"
          bg="var(--color-surface-container)"
          c="var(--color-on-surface)"
          fz={10}
          fw={800}
        >
          {initials(creator)}
        </Avatar>
        <Text size="xs" fw={600} c="var(--color-on-surface-variant)" truncate>
          {creator}
        </Text>
      </Group>

      <Text mt={8} mih={40} size="sm" fw={800} lh={1.25} style={clampedTitleStyle}>
        {title}
      </Text>

      <Group mt="xl" justify="space-between" gap="xs" c="var(--color-on-surface-variant)">
        <Text span size="xs" fw={700}>
          {meta}
        </Text>
        <Group gap={4} wrap="nowrap">
          <Icon name="Heart" size={14} weight="fill" aria-hidden />
          <Text span size="xs" fw={700}>
            {count}
          </Text>
        </Group>
      </Group>
    </Card>
  )
}

function TeacherResourceCard({ href, title, meta, icon }: TeacherResource) {
  return (
    <Card
      component={Link}
      href={href}
      withBorder
      classNames={{ root: surfaceInteractiveClassName }}
      radius={8}
      shadow="xs"
      padding={18}
      style={{ ...borderedCardStyle, minHeight: 118 }}
    >
      <Group gap={14} wrap="nowrap" h="100%">
        <ThemeIcon
          size={40}
          radius="md"
          bg="var(--color-primary-wash)"
          c="var(--color-primary-deep)"
          aria-hidden="true"
        >
          <Icon name={icon} size={24} weight="fill" aria-hidden />
        </ThemeIcon>
        <Box miw={0}>
          <Text size="sm" fw={800} c="var(--color-on-surface)" truncate>
            {title}
          </Text>
          <Text mt={4} size="xs" fw={600} c="var(--color-on-surface-variant)">
            {meta}
          </Text>
        </Box>
      </Group>
    </Card>
  )
}

function TeacherClassCard({ classItem, studentCountLabel }: TeacherClassCardProps) {
  return (
    <Card
      component={Link}
      href={ROUTES.TEACHER.CLASS(classItem.id)}
      withBorder
      classNames={{ root: surfaceInteractiveClassName }}
      radius={8}
      shadow="xs"
      padding="xl"
      style={{
        ...borderedCardStyle,
        width: 470,
        minWidth: 320,
        minHeight: 156,
        flex: '0 0 min(470px, 100%)',
      }}
    >
      <Stack align="center" justify="center" gap={4}>
        <Avatar
          size={64}
          radius={8}
          bg="var(--color-purple-dim)"
          c="var(--color-on-primary)"
          fz={24}
          fw={800}
          aria-hidden="true"
        >
          {initials(classItem.name)}
        </Avatar>
        <Text mt={12} size="md" fw={800} c="var(--color-on-surface)">
          {classItem.name}
        </Text>
        <Text size="sm" fw={600} c="var(--color-on-surface-variant)">
          {studentCountLabel}
        </Text>
      </Stack>
    </Card>
  )
}

function EmptyClassesCard({ title, body, actionLabel }: EmptyClassesCardProps) {
  return (
    <Paper
      mt="sm"
      radius="md"
      withBorder
      p="xl"
      ta="center"
      bg="var(--color-surface-container-lowest)"
      style={{ borderStyle: 'dashed', borderColor: 'var(--color-outline-variant)' }}
    >
      <Text fw={800} c="var(--color-on-surface)">
        {title}
      </Text>
      <Text mt={4} size="sm" fw={600} c="var(--color-on-surface-variant)">
        {body}
      </Text>
      <Anchor
        component={Link}
        className={surfaceInteractiveClassName}
        href={ROUTES.TEACHER.CLASS_NEW}
        mt="md"
        fw={800}
        c="var(--color-purple-dim)"
        underline="hover"
      >
        {actionLabel}
      </Anchor>
    </Paper>
  )
}

export function TeacherDashboardContent({
  classes,
  countByClass,
}: TeacherDashboardContentProps) {
  const { t } = useTranslation('teacher')

  const primaryClass = classes.find((classItem) => classItem.is_active) ?? classes[0] ?? null
  const postToJournalHref = primaryClass ? ROUTES.TEACHER.CLASS_JOURNAL_NEW(primaryClass.id) : ROUTES.TEACHER.CLASS_NEW
  const classCards = primaryClass
    ? [primaryClass, ...classes.filter((classItem) => classItem.id !== primaryClass.id)].slice(0, 3)
    : classes.slice(0, 3)
  const gradeLabel = primaryClass?.grade_level
    ? t(`classes.gradeLevel.${primaryClass.grade_level}`, { defaultValue: primaryClass.name })
    : primaryClass?.name ?? t('dashboard.home.library.gradeFallback')

  const actions: HomeAction[] = [
    {
      href: postToJournalHref,
      icon: 'BookOpen',
      title: t('dashboard.home.actions.postJournal.title'),
      subtitle: t('dashboard.home.actions.postJournal.body'),
      tone: 'journal',
    },
    {
      href: ROUTES.TEACHER.ACTIVITY_CREATE,
      icon: 'Lightbulb',
      title: t('dashboard.home.actions.createActivity.title'),
      subtitle: t('dashboard.home.actions.createActivity.body'),
      tone: 'purple',
    },
    {
      href: ROUTES.TEACHER.ACTIVITY_GENERATE,
      icon: 'Sparkle',
      title: t('dashboard.home.actions.generateActivity.title'),
      subtitle: t('dashboard.home.actions.generateActivity.body'),
      tone: 'purple',
    },
  ]

  const libraryHref = ROUTES.TEACHER.LIBRARIES_EXPLORE
  const libraryFallbackCard = (
    key: 'reading' | 'assessment' | 'math' | 'science',
    meta: string,
    tone: ThumbnailTone,
    count: number,
  ): LibraryCard => {
    const title = t(`dashboard.home.library.fallbackCards.${key}.title`)

    return {
      href: libraryHref,
      title,
      creator: t(`dashboard.home.library.fallbackCards.${key}.creator`),
      meta,
      imageAlt: title,
      tone,
      count,
    }
  }

  const libraryCards: LibraryCard[] = [
    libraryFallbackCard('reading', t('dashboard.home.library.subjectMeta'), 'green', 280),
    libraryFallbackCard('assessment', t('dashboard.home.library.assessmentMeta'), 'gold', 130),
    libraryFallbackCard('math', t('dashboard.home.library.assessmentMeta'), 'pink', 310),
    libraryFallbackCard('science', t('dashboard.home.library.subjectMeta'), 'blue', 350),
  ]

  const resources: TeacherResource[] = [
    {
      href: ROUTES.TEACHER.HELP,
      title: t('dashboard.home.resources.spotlight.title'),
      meta: t('dashboard.home.resources.spotlight.meta'),
      icon: 'PlayCircle',
    },
    {
      href: libraryHref,
      title: t('dashboard.home.resources.learning.title'),
      meta: t('dashboard.home.resources.learning.meta'),
      icon: 'GraduationCap',
    },
    {
      href: ROUTES.TEACHER.ACTIVITIES,
      title: t('dashboard.home.resources.topics.title'),
      meta: t('dashboard.home.resources.topics.meta'),
      icon: 'Calendar',
    },
  ]

  return (
    <Box
      component="main"
      aria-label={t('dashboard.home.mainAriaLabel', { defaultValue: 'Acasă profesor' })}
      bg="var(--color-surface)"
      c="var(--color-on-surface)"
      style={pageStyle}
      data-testid="teacher-home"
    >
      <Stack gap={16} py={12} pb={{ base: 88, sm: 32 }} style={columnStyle} data-testid="teacher-home-column">
        <TeacherHomePanel label={t('dashboard.home.actions.ariaLabel')}>
          <SimpleGrid minColWidth={280} spacing={16}>
            {actions.map((action) => (
              <TeacherHomeActionCard key={action.href} {...action} />
            ))}
          </SimpleGrid>
        </TeacherHomePanel>

        <TeacherHomePanel label={t('dashboard.home.library.ariaLabel')}>
          <Box component="form" action={libraryHref} role="search">
            <Stack gap={8}>
              <Title order={2} size="h3" lh={1.2} c="var(--color-on-surface)">
                {t('dashboard.home.library.title', { grade: gradeLabel })}
              </Title>
              <TextInput
                id="teacher-home-library-search"
                name="q"
                type="search"
                size="md"
                radius={8}
                aria-label={t('dashboard.home.library.searchPlaceholder')}
                placeholder={t('dashboard.home.library.searchPlaceholder')}
                classNames={{ input: inputInteractiveClassName }}
                rightSectionPointerEvents="all"
                rightSectionWidth={56}
                rightSection={
                  <ActionIcon
                    component="button"
                    classNames={{ root: actionInteractiveClassName }}
                    type="submit"
                    size={44}
                    radius={8}
                    bg="var(--color-purple-dim)"
                    c="var(--color-on-primary)"
                    aria-label={t('dashboard.home.library.searchPlaceholder')}
                  >
                    <Icon name="MagnifyingGlass" size="md" weight="bold" aria-hidden />
                  </ActionIcon>
                }
                styles={{
                  input: {
                    borderColor: 'var(--color-outline)',
                    color: 'var(--color-on-surface)',
                    fontWeight: 600,
                    minHeight: 44,
                  },
                }}
              />
            </Stack>
          </Box>

          <Box mt={32}>
            <Group mb={16} justify="space-between" gap="md">
              <Title order={2} size="h3" lh={1.2} c="var(--color-on-surface)">
                {t('dashboard.home.library.popularTitle', { grade: gradeLabel })}
              </Title>
              <Anchor
                component={Link}
                className={surfaceInteractiveClassName}
                href={libraryHref}
                fw={800}
                c="var(--color-purple-dim)"
                underline="hover"
              >
                {t('dashboard.home.library.viewAll')}
              </Anchor>
            </Group>
            <Box style={{ overflowX: 'auto' }}>
              <Group gap={18} wrap="nowrap" pb={2}>
                {libraryCards.map((activity) => (
                  <Box key={`${activity.title}-${activity.creator}`} w={191} flex="0 0 191px">
                    <CommunityActivityCard {...activity} />
                  </Box>
                ))}
              </Group>
            </Box>
          </Box>
        </TeacherHomePanel>

        <TeacherHomePanel label={t('dashboard.home.classes.ariaLabel')}>
          <Title order={2} size="h3" lh={1.2} c="var(--color-on-surface)">
            {t('dashboard.home.classes.title')}
          </Title>
          {classCards.length > 0 ? (
            <Box mt={8} style={{ overflowX: 'auto' }}>
              <Group gap={16} wrap="nowrap" pb={1}>
                {classCards.map((classItem) => {
                  const studentCount = countByClass[classItem.id] ?? 0
                  const studentCountLabel =
                    studentCount === 1
                      ? t('dashboard.home.classes.studentOne', { count: studentCount })
                      : t('dashboard.home.classes.studentOther', { count: studentCount })

                  return (
                    <TeacherClassCard
                      key={classItem.id}
                      classItem={classItem}
                      studentCountLabel={studentCountLabel}
                    />
                  )
                })}
              </Group>
            </Box>
          ) : (
            <EmptyClassesCard
              title={t('dashboard.home.classes.emptyTitle')}
              body={t('dashboard.home.classes.emptyBody')}
              actionLabel={t('dashboard.home.classes.createClass')}
            />
          )}
        </TeacherHomePanel>

        <TeacherHomePanel label={t('dashboard.home.resources.ariaLabel')}>
          <Group mb={16} justify="space-between" gap="md">
            <Title order={2} size="h3" lh={1.2} c="var(--color-on-surface)">
              {t('dashboard.home.resources.title')}
            </Title>
            <Anchor
              component={Link}
              className={surfaceInteractiveClassName}
              href={ROUTES.TEACHER.HELP}
              fw={800}
              c="var(--color-purple-dim)"
              underline="hover"
            >
              {t('dashboard.home.resources.viewAll')}
            </Anchor>
          </Group>
          <SimpleGrid minColWidth={260} spacing={16}>
            {resources.map((resource) => (
              <TeacherResourceCard key={resource.href} {...resource} />
            ))}
          </SimpleGrid>
        </TeacherHomePanel>
      </Stack>
    </Box>
  )
}
