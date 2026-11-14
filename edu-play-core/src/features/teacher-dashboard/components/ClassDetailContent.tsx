'use client'



import { useState } from 'react'
import Link from 'next/link'

import { useTranslation } from 'react-i18next'

import { motion, useReducedMotion } from 'framer-motion'
import { ActionIcon, Button as MantineButton } from '@mantine/core'

import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'

import { formatDateLong, formatWeekdayMonthDay } from '@/lib/i18n/formatters'
import { Button, Card, FilterChipGroup, Pill, StatCard } from '@/shared/components/ui/kit'

import { StudentRosterTable } from './StudentRosterTable'

import { QuickActionsPanel } from './QuickActionsPanel'
import classes from './ClassDetailContent.module.css'



import { ROUTES } from '@/shared/lib/constants'

import type { ClassDetailData, ClassDetailStudent } from '../server'



export function ClassDetailContent({

  classData,

  stats,

  studentRoster,

  leaderboard,

}: ClassDetailData) {

  const { t } = useTranslation('teacher')

  const reduceMotion = useReducedMotion()



  return (

    <div className="flex h-full min-h-screen flex-col bg-surface text-on-surface">

      <div className="p-6 lg:p-10">

        <div className="mx-auto max-w-[1440px] space-y-10">

          {/* Breadcrumb */}

          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">

            <Link

              href={ROUTES.TEACHER.CLASSES}

              className="font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"

            >

              {t('classes.detail.breadcrumb.classes')}

            </Link>

            <Icon name="CaretRight" size="sm" className="text-on-surface-variant" />

            <span className="font-bold text-on-surface truncate max-w-[200px]">

              {classData.name}

            </span>

          </nav>



          {/* Class Header */}

          <motion.div

            initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}

            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}

            transition={{ duration: 0.3 }}

            className="flex flex-wrap items-center gap-4"

          >

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">

              <Icon name="BookOpen" size="xl" weight="bold" />

            </div>

            <div className="min-w-0 flex-1">

              <h1 className="font-headline text-2xl font-bold text-on-surface md:text-3xl">

                {classData.name}

              </h1>

              {classData.description && (

                <p className="mt-1 text-sm text-on-surface-variant line-clamp-1">

                  {classData.description}

                </p>

              )}

            </div>

            <Pill tone={classData.is_active ? 'lime' : 'cream'}>

              {classData.is_active

                ? t('classes.card.statusActive')

                : t('classes.card.statusArchived')}

            </Pill>

          </motion.div>



          {/* Stats Row */}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">

            <StatCard

              label={t('classes.detail.stats.totalStudents')}

              value={stats.totalStudents}

              icon="Users"

              tone="primary"

            />

            <StatCard

              label={t('classes.detail.stats.activeStudents')}

              value={stats.activeStudents}

              icon="Lightning"

              tone="tertiary"

            />

            <StatCard

              label={t('classes.detail.stats.lessonsInProgress')}

              value={stats.lessonsInProgress}

              icon="BookOpen"

              tone="secondary"

            />

            <StatCard

              label={t('classes.detail.stats.awardsToday')}

              value={stats.awardsToday}

              icon="Trophy"

              tone="warning"

            />

          </div>



          {/* Main Grid */}

          <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-12">

            <div className="xl:col-span-8">

              <StudentRosterTable

                students={studentRoster}

                classId={classData.id}

              />

            </div>

            <div className="flex flex-col gap-6 xl:col-span-4">
              <QuickActionsPanel classId={classData.id} />
              <Card className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">Obiectiv săptămânal</p>
                <h2 className="font-headline text-lg font-bold text-on-surface">Ține ritmul clasei</h2>
                <p className="text-sm text-on-surface-variant">
                  {stats.activeStudents} din {stats.totalStudents} elevi au activitate în lucru acum.
                </p>
              </Card>
              <Card className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">Clasament clasă</p>
                <ul className="space-y-2">
                  {leaderboard.slice(0, 3).map((student, index) => (
                    <li key={student.id} className={index === 0 ? '' : 'border-t border-outline-variant pt-2'}>
                      <Link href={ROUTES.TEACHER.STUDENT(student.id)} className="flex items-center justify-between gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        <span className="truncate text-sm font-semibold text-on-surface">{student.fullName}</span>
                        <span className="text-xs font-bold text-primary">{student.totalScore}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>


          </div>

        </div>

      </div>

    </div>

  )

}


type ClassTab = 'activities' | 'journal' | 'gradebook' | 'notifications'

interface ClassTabContentProps {
  data: ClassDetailData
  activeTab: ClassTab
}

const classTabItems: Array<{
  tab: ClassTab
  labelKey: string
  icon: IconName
  href: (classId: string) => string
}> = [
  {
    tab: 'journal',
    labelKey: 'classes.detail.tabs.journal',
    icon: 'BookOpen',
    href: ROUTES.TEACHER.CLASS_JOURNAL,
  },
  {
    tab: 'activities',
    labelKey: 'classes.detail.tabs.activities',
    icon: 'Lightbulb',
    href: ROUTES.TEACHER.CLASS_ACTIVITIES,
  },
  {
    tab: 'gradebook',
    labelKey: 'classes.detail.tabs.gradebook',
    icon: 'GraduationCap',
    href: ROUTES.TEACHER.CLASS_GRADEBOOK,
  },
  {
    tab: 'notifications',
    labelKey: 'classes.detail.tabs.notifications',
    icon: 'Bell',
    href: ROUTES.TEACHER.CLASS_NOTIFICATIONS,
  },
]

export function ClassTabContent({ data, activeTab }: ClassTabContentProps) {
  const { t } = useTranslation('teacher')
  const { classData, profile, studentRoster, stats } = data
  const [feedFilter, setFeedFilter] = useState('class')
  const postCount = studentRoster.filter((student) => student.recentGameTitle).length || studentRoster.length
  const attentionCount = studentRoster.filter((student) => student.status === 'needs_help').length
  const unapprovedCount = 0
  const formatPostCount = (count: number) =>
    t(
      count === 1
        ? 'classes.detail.journal.postCountOne'
        : 'classes.detail.journal.postCountOther',
      { count },
    )
  const tabNavLabel = t('classes.detail.tabs.ariaLabel', { name: classData.name })
  const selectedStudent = studentRoster.find((student) => student.status === 'needs_help') ?? studentRoster[0]
  const feedFilterItems = [
    { value: 'class', icon: 'BookOpen' as const, label: t('classes.detail.journal.classJournal') },
    { value: 'date', icon: 'Calendar' as const, label: t('classes.detail.journal.dateFilter') },
    { value: 'folders', icon: 'Archive' as const, label: t('classes.detail.journal.folders') },
  ]

  return (
    <main data-testid="class-workspace" className={classes.workspace}>
      <aside className={classes.workspaceRail}>
        <Link
          href={ROUTES.TEACHER.DASHBOARD}
          aria-label="EduPlay"
          className={classes.railBrand}
        >
          EP
        </Link>
        <nav aria-label="Navigare EduPlay" className={classes.railNav}>
          <RailLink href={ROUTES.TEACHER.DASHBOARD} label={t('dashboard.topAppBarTitle')} icon="House" />
          <RailLink href={ROUTES.TEACHER.CLASSES} label={t('classes.topBarTitle')} icon="Users" />
          <RailLink href={ROUTES.TEACHER.ACTIVITIES} label={t('activities.title')} icon="Lightbulb" />
          <RailLink href={ROUTES.TEACHER.LIBRARY} label={t('dashboard.home.classes.title')} icon="Star" />
          <RailClassLink
            href={ROUTES.TEACHER.CLASS(classData.id)}
            label={classData.name}
            initials={classInitials(classData.name)}
          />
        </nav>
      </aside>

      <div className={classes.workspaceBody}>
        <header className={classes.classHeader}>
          <div className={classes.classHeaderInner}>
            <div className={classes.classAvatar}>
              {classInitials(classData.name)}
            </div>
            <div className={classes.classHeaderText}>
              <p className={classes.classMeta}>{classData.grade_level ?? classData.school_year}</p>
              <h1 className="truncate font-headline text-2xl font-bold md:text-3xl">{classData.name}</h1>
            </div>
            <div className={classes.classActions}>
              <Link
                href={ROUTES.TEACHER.CLASS_SETTINGS(classData.id)}
                aria-label={t('classes.detail.actions.classSettings')}
                className={classes.classSettingsButton}
              >
                <Icon name="Wrench" size="md" aria-hidden />
              </Link>
              <Button
                href={ROUTES.TEACHER.CLASS_JOURNAL_NEW(classData.id)}
              >
                <Icon name="Plus" size="sm" aria-hidden />
                {t('dashboard.addMenu.button')}
              </Button>
            </div>
          </div>

          <nav aria-label={tabNavLabel} className={classes.tabNav}>
            {classTabItems.map((item) => {
              const isActive = activeTab === item.tab
              return (
                <Link
                  key={item.tab}
                  href={item.href(classData.id)}
                  aria-current={isActive ? 'page' : undefined}
                  data-active={isActive || undefined}
                  className={classes.tabLink}
                >
                  <Icon name={item.icon} size="sm" weight={isActive ? 'fill' : 'regular'} aria-hidden />
                  {t(item.labelKey)}
                </Link>
              )
            })}
          </nav>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className={`${classes.journalSidebar} flex shrink-0 flex-col border-b border-outline bg-surface-container-lowest md:border-b-0 md:border-r`}>
            <nav aria-label={t('classes.detail.journal.studentNavAria')} className="min-h-0 flex-1 overflow-y-auto">
              <Link
                href={ROUTES.TEACHER.CLASS_JOURNAL(classData.id)}
                className={classes.rosterActiveLink}
              >
                <span className={classes.rosterClassAvatar}>
                  {classInitials(classData.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{t('classes.detail.journal.classJournal')}</span>
                  <span className={classes.rosterActiveMeta}>{formatPostCount(postCount)}</span>
                </span>
              </Link>
              {studentRoster.map((student) => (
                <Link
                  key={student.id}
                  href={ROUTES.TEACHER.STUDENT(student.id)}
                  className={classes.rosterLink}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-headline text-base font-bold text-primary-deep">
                    {classInitials(student.fullName)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-on-surface">{student.fullName}</span>
                    <span className="block text-xs font-semibold text-on-surface-variant">
                      {formatPostCount(student.recentGameTitle ? 1 : 0)}
                    </span>
                  </span>
                </Link>
              ))}
            </nav>
            <div className="grid grid-cols-2 gap-2 border-t border-outline-variant p-3">
              <Button
                href={ROUTES.TEACHER.CLASS_STUDENT_NEW(classData.id)}
                variant="secondary"
                size="md"
                className="justify-center"
              >
                <Icon name="PlusCircle" size="sm" aria-hidden />
                {t('classes.detail.actions.addStudents')}
              </Button>
              <Button
                href={ROUTES.TEACHER.CLASS_FAMILIES(classData.id)}
                variant="secondary"
                size="md"
                className="justify-center"
              >
                <Icon name="Users" size="sm" aria-hidden />
                {t('settingsHome.inviteFamilies')}
              </Button>
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col">
            <div className={classes.feedFilterBar}>
              <p className={classes.feedFilterLabel}>{t('classes.detail.journal.feedFilter')}</p>
              <FilterChipGroup
                items={feedFilterItems}
                value={feedFilter}
                onChange={setFeedFilter}
                ariaLabel={t('classes.detail.journal.feedFilter')}
                size="lg"
                radius="md"
                gap="sm"
                className={classes.feedFilterGroup}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
              {activeTab === 'journal' ? (
                <JournalPanel
                  classData={classData}
                  profileName={profile.full_name}
                  students={studentRoster}
                  selectedStudent={selectedStudent}
                  formatPostCount={formatPostCount}
                />
              ) : null}

              {activeTab === 'activities' ? (
                <ActivitiesPanel
                  className={classData.name}
                  students={studentRoster}
                  completedCount={stats.awardsToday || 1}
                  reviewCount={Math.max(attentionCount, 1)}
                />
              ) : null}

              {activeTab === 'gradebook' ? (
                <GradebookPanel className={classData.name} students={studentRoster} />
              ) : null}

              {activeTab === 'notifications' ? (
                <NotificationsPanel
                  className={classData.name}
                  profileName={profile.full_name}
                  students={studentRoster}
                  unapprovedCount={unapprovedCount}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function RailLink({ href, label, icon }: { href: string; label: string; icon: IconName }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={classes.railLink}
    >
      <Icon name={icon} size="md" aria-hidden />
    </Link>
  )
}

function RailClassLink({ href, label, initials }: { href: string; label: string; initials: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={classes.railClassLink}
    >
      {initials}
    </Link>
  )
}

function JournalPanel({
  classData,
  profileName,
  students,
  selectedStudent,
  formatPostCount,
}: {
  classData: ClassDetailData['classData']
  profileName: string
  students: ClassDetailStudent[]
  selectedStudent?: ClassDetailStudent
  formatPostCount: (count: number) => string
}) {
  const { t } = useTranslation('teacher')
  const secondaryEntries = selectedStudent
    ? students.filter((student) => student.id !== selectedStudent.id)
    : students

  return (
    <section aria-labelledby="class-journal-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="class-journal-title" className="font-headline text-xl font-bold text-on-surface">
            {t('classes.detail.journal.classJournal')}
          </h2>
          <h3 className="mt-1 text-sm font-semibold text-on-surface-variant">
            {t('classes.detail.journal.feedTitle')}
          </h3>
        </div>
      </div>

      {selectedStudent ? (
        <article className="overflow-hidden rounded-md border border-outline bg-surface-container-lowest shadow-soft-sm">
          <header className="flex items-center gap-3 border-b border-outline-variant px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-headline text-sm font-bold text-on-primary">
              {classInitials(classData.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-on-surface">{t('classes.detail.journal.everyone')}</p>
              <p className="truncate text-xs font-semibold text-on-surface-variant">{profileName}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft font-headline text-xs font-bold text-primary-deep">
              {classInitials(profileName)}
            </span>
          </header>

          <div className="flex min-h-80 items-center justify-center bg-surface-container-lowest p-6">
            <svg
              aria-hidden
              viewBox="0 0 640 300"
              className="h-64 w-full max-w-3xl text-blue-dim"
              fill="none"
              stroke="var(--color-blue-dim)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="6"
            >
              <path d="M146 160 C236 92 360 76 493 156" />
              <path d="M178 156 C260 110 360 96 464 152" />
              <path d="M214 154 C298 116 374 112 428 152" />
              <path d="M234 157 V263" />
              <path d="M420 157 V263" />
              <path d="M234 244 C290 251 366 250 424 244" />
              <path d="M178 171 C264 177 374 177 486 167" />
            </svg>
          </div>

          <div className="border-t border-outline-variant px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-xs font-bold text-on-surface-variant">
                  <Icon name="Archive" size="sm" aria-hidden className="text-notification" />
                  {t('classes.detail.journal.folderLabel')}
                </p>
                <p className="mt-2 text-sm font-bold text-on-surface">
                  {selectedStudent.fullName}{' '}
                  <span className="font-semibold">
                    {selectedStudent.recentGameTitle ?? t('classes.detail.journal.addedNewItem')}
                  </span>
                </p>
                <p className="mt-2 text-xs font-semibold text-on-surface-variant">
                  {t('classes.detail.journal.taggedFolders')}: {t('classes.detail.journal.folderLabel')}
                </p>
              </div>
              <time className="text-xs font-semibold text-on-surface-variant" dateTime={selectedStudent.recentGameTime ?? undefined}>
                {formatJournalDate(selectedStudent.recentGameTime)}
              </time>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <MantineButton
                type="button"
                variant="default"
                size="md"
                radius="md"
                className={classes.journalActionButton}
                leftSection={<Icon name="Heart" size="sm" aria-hidden />}
              >
                {t('classes.detail.journal.like')}
              </MantineButton>
              <MantineButton
                type="button"
                variant="default"
                size="md"
                radius="md"
                className={classes.journalActionButton}
                leftSection={<Icon name="PencilSimple" size="sm" aria-hidden />}
              >
                {t('classes.detail.journal.comment')}
              </MantineButton>
              <ActionIcon
                type="button"
                variant="default"
                size={44}
                radius="md"
                aria-label={t('classes.detail.journal.showMore')}
                className={classes.journalMoreButton}
              >
                <Icon name="DotsThreeVertical" size="md" aria-hidden />
              </ActionIcon>
            </div>
          </div>
        </article>
      ) : (
        <p className="rounded-md border border-outline bg-surface-container-lowest p-5 text-sm font-semibold text-on-surface-variant">
          {t('classes.detail.journal.noPosts')}
        </p>
      )}

      {secondaryEntries.length > 0 ? (
        <ul className="space-y-3">
          {secondaryEntries.map((student) => (
            <li key={student.id} className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-soft-sm">
              <p className="text-sm font-bold text-on-surface">{student.fullName}</p>
              <p className="text-xs font-semibold text-on-surface-muted">{formatJournalDate(student.recentGameTime)}</p>
              <p className="mt-2 text-sm text-on-surface-variant">{t('classes.detail.journal.taggedFolders')}</p>
              <p className="mt-1 text-sm text-on-surface">{t('classes.detail.journal.folderLabel')}</p>
              <p className="mt-1 text-sm text-on-surface">{student.recentGameTitle ?? t('classes.detail.journal.addedNewItem')}</p>
              <p className="mt-1 text-xs font-semibold text-on-surface-variant">{formatPostCount(student.recentGameTitle ? 1 : 0)}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function ActivitiesPanel({
  className,
  students,
  completedCount,
  reviewCount,
}: {
  className: string
  students: ClassDetailStudent[]
  completedCount: number
  reviewCount: number
}) {
  const { t } = useTranslation('teacher')
  const fallbackRow: ClassDetailStudent = {
    id: 'class',
    fullName: t('classes.detail.activities.classFallbackName'),
    username: t('classes.detail.activities.classFallbackUsername'),
    avatarUrl: null,
    status: 'offline',
    recentGameTitle: t('classes.detail.activities.fallbackTitle'),
    recentGameTime: null,
    lessonProgress: 0,
    totalScore: 0,
  }
  const activityRows = students.length > 0
    ? students
    : [fallbackRow]

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="rounded-md border border-outline bg-surface-container-lowest p-5 shadow-soft-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-on-surface-variant">{t('classes.detail.activities.pullToRefresh')}</p>
            <h2 className="mt-1 font-headline text-xl font-bold text-on-surface">{t('classes.detail.activities.title')}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {t('classes.detail.activities.description', { name: className })}
            </p>
          </div>
        </div>
        <ul className="space-y-3">
          {activityRows.map((student) => (
            <li key={student.id} className="rounded-md border border-outline-variant bg-surface p-4">
              <h3 className="font-headline text-lg font-bold text-on-surface">
                {student.recentGameTitle ?? t('classes.detail.activities.fallbackTitle')}
              </h3>
              <p className="mt-1 text-sm font-semibold text-on-surface-variant">{t('classes.detail.activities.assignedToAll')}</p>
              <p className="mt-2 text-sm text-on-surface-variant">{student.fullName}</p>
            </li>
          ))}
        </ul>
      </div>
      <aside className="rounded-md border border-outline bg-surface-container-lowest p-5 shadow-soft-sm">
        <Link href={ROUTES.TEACHER.ASSIGNMENTS} className="font-semibold text-primary hover:text-primary-dim">
          {t('classes.detail.activities.viewAssignments')}
        </Link>
        <div className="mt-4 space-y-2 text-sm font-semibold text-on-surface">
          <p>{completedCount} {t('classes.detail.activities.completed')}</p>
          <p>{reviewCount} {t('classes.detail.activities.waitingForReview')}</p>
        </div>
      </aside>
    </section>
  )
}

function GradebookPanel({ className, students }: { className: string; students: ClassDetailStudent[] }) {
  const { t } = useTranslation('teacher')

  return (
    <section className="rounded-md border border-outline bg-surface-container-lowest p-5 shadow-soft-sm">
      <p className="text-sm font-bold text-primary">{t('classes.detail.gradebook.eyebrow')}</p>
      <h2 className="mt-1 font-headline text-xl font-bold text-on-surface">{t('classes.detail.gradebook.title')}</h2>
      <p className="mt-2 text-sm text-on-surface-variant">{t('classes.detail.gradebook.description')}</p>
      <p className="mt-4 rounded-md bg-surface-container p-4 text-sm font-semibold text-on-surface-variant">
        {t('classes.detail.gradebook.preview', { name: className })}
      </p>
      {students.length > 0 ? (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {students.map((student) => (
            <li key={student.id} className="rounded-md border border-outline-variant bg-surface p-4">
              <p className="text-sm font-bold text-on-surface">{student.fullName}</p>
              <p className="mt-1 text-sm text-on-surface-variant">{student.lessonProgress}%</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function NotificationsPanel({
  className,
  profileName,
  students,
  unapprovedCount,
}: {
  className: string
  profileName: string
  students: ClassDetailStudent[]
  unapprovedCount: number
}) {
  const { t } = useTranslation('teacher')
  const student = students.find((item) => item.status === 'needs_help') ?? students[0]
  const studentName = student?.fullName ?? t('classes.detail.notifications.studentFallback')
  const activityTitle = student?.recentGameTitle ?? t('classes.detail.activities.fallbackTitle')

  return (
    <section className="rounded-md border border-outline bg-surface-container-lowest p-5 shadow-soft-sm">
      <h2 className="font-headline text-xl font-bold text-on-surface">{t('classes.detail.notifications.title')}</h2>
      <p className="mt-2 text-sm text-on-surface-variant">{t('classes.detail.notifications.loading')}</p>
      <p className="mt-3 text-sm font-semibold text-primary">{t('classes.detail.notifications.tapHere')}</p>
      <p className="mt-4 text-sm text-on-surface-variant">
        {t(
          unapprovedCount === 1
            ? 'classes.detail.notifications.unapprovedOne'
            : 'classes.detail.notifications.unapprovedOther',
          { count: unapprovedCount },
        )}
      </p>
      <div className="mt-4 space-y-3 text-sm text-on-surface">
        <p>
          <strong>{formatShortJournalDate(student?.recentGameTime)}</strong> ·{' '}
          {t('classes.detail.notifications.commentRequest', {
            name: studentName,
            owner: profileName,
            title: activityTitle,
          })}
        </p>
        <p>{t('classes.detail.notifications.itemRequest', { name: studentName })}</p>
        <p>{t('classes.detail.notifications.itemRequest', { name: studentName })}</p>
        <p><strong>{formatShortJournalDate('2026-04-28T12:00:00.000Z')}</strong></p>
        <p>{t('classes.detail.notifications.weeklyDigest', { name: className })}</p>
      </div>
    </section>
  )
}

function classInitials(value: string | null | undefined) {
  const parts = (value ?? '').split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase('ro-RO') ?? '')
      .join('')
  }
  const word = parts[0] ?? '?'
  const raw = word.slice(0, 2)
  return raw ? raw[0].toLocaleUpperCase('ro-RO') + raw.slice(1).toLocaleLowerCase('ro-RO') : '?'
}

function dateFrom(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date('2026-05-22T18:45:00.000Z')
  return Number.isNaN(date.getTime()) ? new Date('2026-05-22T18:45:00.000Z') : date
}

function formatJournalDate(value: string | null | undefined) {
  return formatDateLong(dateFrom(value))
}

function formatShortJournalDate(value: string | null | undefined) {
  return formatWeekdayMonthDay(dateFrom(value))
}
