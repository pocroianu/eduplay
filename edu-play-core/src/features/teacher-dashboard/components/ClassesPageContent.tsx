'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { TextInput } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/Icon'
import { Button, Card, EmptyState, FilterChipGroup, Pill } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'
import classes from './ClassesPageContent.module.css'

type FilterKey = 'all' | 'active' | 'archived'
type GradeLevelKey = 'preschool' | 'kindergarten' | 'grade-1' | 'grade-2'

interface ClassItem {
  id: string
  name: string
  description: string | null
  grade_level: string | null
  school_year: string | null
  is_active: boolean
}

interface ClassesPageContentProps {
  profile: {
    id: string
    full_name: string
    email: string
    role: string
    avatar_url?: string | null
  }
  classes: ClassItem[]
  countByClass: Record<string, number>
}

const GRADE_LEVEL_KEYS: ReadonlySet<GradeLevelKey> = new Set([
  'preschool',
  'kindergarten',
  'grade-1',
  'grade-2',
])

const searchInputStyles = {
  input: {
    backgroundColor: 'var(--color-surface-container-lowest)',
    borderColor: 'var(--color-outline-variant)',
    color: 'var(--color-on-surface)',
    fontWeight: 600,
    minHeight: 44,
  },
} as const

function isGradeLevelKey(value: string): value is GradeLevelKey {
  return (GRADE_LEVEL_KEYS as ReadonlySet<string>).has(value)
}

export function ClassesPageContent({ classes, countByClass }: ClassesPageContentProps) {
  const { t } = useTranslation('teacher')
  const reduceMotion = useReducedMotion()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  const filters = useMemo(
    () => [
      { key: 'all' as const, label: t('classes.filters.all') },
      { key: 'active' as const, label: t('classes.filters.active') },
      { key: 'archived' as const, label: t('classes.filters.archived') },
    ],
    [t],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return classes.filter((cls) => {
      if (filter === 'active' && !cls.is_active) return false
      if (filter === 'archived' && cls.is_active) return false
      if (!q) return true

      return (
        cls.name.toLowerCase().includes(q) ||
        (cls.description?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [classes, filter, search])

  const hasAnyClass = classes.length > 0
  const hasFiltered = filtered.length > 0

  return (
    <div className="flex h-full min-h-screen flex-col bg-surface-container text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest" aria-label={t('classes.header.eyebrow')}>
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-deep">
              {t('classes.header.eyebrow')}
            </p>
            <h1 className="mt-1 font-headline text-2xl font-bold leading-tight text-on-surface md:text-3xl">
              {t('classes.header.title')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm font-medium text-on-surface-variant">
              {t('classes.header.subtitle')}
            </p>
          </div>
          <Button href={ROUTES.TEACHER.CLASS_NEW} size="md" className="shrink-0">
            <Icon name="Plus" size="sm" weight="bold" aria-hidden />
            {t('classes.header.newClassCta')}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-5 px-6 py-6 lg:px-10">
        {hasAnyClass ? (
          <>
            <Card className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <FilterChipGroup
                  ariaLabel={t('classes.filters.ariaLabel')}
                  items={filters.map((option) => ({
                    value: option.key,
                    label: option.label,
                  }))}
                  value={filter}
                  onChange={(value) => setFilter(value as FilterKey)}
                />

                <TextInput
                  type="search"
                  aria-label={t('classes.search.ariaLabel')}
                  placeholder={t('classes.search.placeholder')}
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  radius={8}
                  size="md"
                  leftSection={<Icon name="MagnifyingGlass" size="sm" aria-hidden />}
                  leftSectionPointerEvents="none"
                  className="w-full lg:w-96"
                  styles={searchInputStyles}
                />
              </div>
            </Card>

            {hasFiltered ? (
              <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((cls, i) => (
                  <ClassCard
                    key={cls.id}
                    cls={cls}
                    studentCount={countByClass[cls.id] || 0}
                    reduceMotion={reduceMotion ?? false}
                    index={i}
                  />
                ))}
              </ul>
            ) : (
              <Card className="p-0">
                <EmptyState
                  icon="MagnifyingGlass"
                  title={t('classes.empty.noResults.title')}
                  description={t('classes.empty.noResults.description')}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch('')
                        setFilter('all')
                      }}
                    >
                      {t('classes.empty.noResults.resetCta')}
                    </Button>
                  }
                />
              </Card>
            )}
          </>
        ) : (
          <Card className="p-0">
            <EmptyState
              icon="Users"
              title={t('classes.empty.noClasses.title')}
              description={t('classes.empty.noClasses.description')}
              action={
                <Button href={ROUTES.TEACHER.CLASS_NEW} size="md">
                  <Icon name="Plus" size="sm" weight="bold" aria-hidden />
                  {t('classes.empty.noClasses.cta')}
                </Button>
              }
            />
          </Card>
        )}
      </main>
    </div>
  )
}

interface ClassCardProps {
  cls: ClassItem
  studentCount: number
  reduceMotion: boolean
  index: number
}

function ClassCard({ cls, studentCount, reduceMotion, index }: ClassCardProps) {
  const { t } = useTranslation('teacher')
  const studentText =
    studentCount === 1
      ? t('classes.card.studentsOne', { count: studentCount })
      : t('classes.card.studentsOther', { count: studentCount })
  const gradeLabel =
    cls.grade_level && isGradeLevelKey(cls.grade_level)
      ? t(`classes.gradeLevel.${cls.grade_level}`)
      : cls.grade_level

  return (
    <motion.li
      className="list-none"
      initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: 'easeOut' }}
    >
      <Link
        href={ROUTES.TEACHER.CLASS(cls.id)}
        aria-label={t('classes.card.openClass', { name: cls.name })}
        className={classes.classCardLink}
      >
        <Card className="h-full p-5 transition-shadow hover:shadow-soft">
          <div className="mb-4 flex items-start justify-between gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-primary-soft text-primary-deep"
            >
              <Icon name="BookOpen" size="xl" weight="bold" />
            </span>
            <Pill tone={cls.is_active ? 'lime' : 'cream'}>
              {cls.is_active ? t('classes.card.statusActive') : t('classes.card.statusArchived')}
            </Pill>
          </div>

          <h3 className="font-headline text-[1.125rem] font-bold leading-tight text-on-surface">
            {cls.name}
          </h3>

          {cls.description ? (
            <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
              {cls.description}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {gradeLabel ? <Pill tone="sky">{gradeLabel}</Pill> : null}
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant">
              <Icon name="Users" size="md" weight="bold" />
              <span>{studentText}</span>
            </span>
          </div>
        </Card>
      </Link>
    </motion.li>
  )
}
