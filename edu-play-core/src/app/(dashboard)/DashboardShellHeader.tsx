'use client'

import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { NotificationBell } from '@/features/parent-portal'
import type { NotificationWithStudent } from '@/features/parent-portal'

interface DashboardShellHeaderProps {
  role: string
  parentNotifications?: {
    unreadCount: number
    recentNotifications: NotificationWithStudent[]
  }
}

const PATH_TITLE_KEYS: Array<[RegExp, string]> = [
  [/^\/teacher\/classes(\/|$)/, 'shell.pageTitles.teacherClasses'],
  [/^\/teacher\/students(\/|$)/, 'shell.pageTitles.teacherStudents'],
  [/^\/teacher\/activities(\/|$)/, 'shell.pageTitles.teacherActivities'],
  [/^\/teacher\/libraries\/explore(\/|$)/, 'shell.pageTitles.teacherLibrariesExplore'],
  [/^\/teacher\/library(\/|$)/, 'shell.pageTitles.teacherLibrary'],
  [/^\/teacher\/assignments(\/|$)/, 'shell.pageTitles.teacherAssignments'],
  [/^\/teacher\/paths(\/|$)/, 'shell.pageTitles.teacherPaths'],
  [/^\/teacher\/portfolio(\/|$)/, 'shell.pageTitles.teacherPortfolio'],
  [/^\/teacher\/games(\/|$)/, 'shell.pageTitles.teacherGames'],
  [/^\/teacher\/language(\/|$)/, 'shell.pageTitles.teacherLanguage'],
  [/^\/teacher\/help(\/|$)/, 'shell.pageTitles.teacherHelp'],
  [/^\/teacher\/scan(\/|$)/, 'shell.pageTitles.teacherScan'],
  [/^\/teacher\/trial(\/|$)/, 'shell.pageTitles.teacherTrial'],
  [/^\/teacher\/account\/settings(\/|$)/, 'shell.pageTitles.teacherAccountSettings'],
  [/^\/teacher\/account\/school(\/|$)/, 'shell.pageTitles.teacherAccountSchool'],
  [/^\/teacher\/account\/device(\/|$)/, 'shell.pageTitles.teacherAccountDevice'],
  [/^\/teacher\/?$/, 'shell.pageTitles.teacher'],
  [/^\/parent\/children(\/|$)/, 'shell.pageTitles.parentChildren'],
  [/^\/parent\/activities(\/|$)/, 'shell.pageTitles.parentActivities'],
  [/^\/parent\/notifications(\/|$)/, 'shell.pageTitles.parentNotifications'],
  [/^\/parent\/?$/, 'shell.pageTitles.parent'],
  [/^\/admin\/users(\/|$)/, 'shell.pageTitles.adminUsers'],
  [/^\/admin\/cms\/activities(\/|$)/, 'shell.pageTitles.adminActivities'],
  [/^\/admin\/flags(\/|$)/, 'shell.pageTitles.adminFlags'],
  [/^\/admin\/audit(\/|$)/, 'shell.pageTitles.adminAudit'],
  [/^\/admin\/privacy(\/|$)/, 'shell.pageTitles.adminPrivacy'],
  [/^\/admin\/?$/, 'shell.pageTitles.admin'],
]

function titleKeyForPath(pathname: string | null): string | null {
  if (!pathname) return null
  for (const [pattern, key] of PATH_TITLE_KEYS) {
    if (pattern.test(pathname)) return key
  }
  return null
}

export function DashboardShellHeader({
  role: _role,
  parentNotifications,
}: DashboardShellHeaderProps) {
  const { t } = useTranslation('common')
  const pathname = usePathname()
  const titleKey = titleKeyForPath(pathname)
  const title = titleKey ? t(titleKey) : ''

  return (
    <header
      aria-label={t('shell.navbarAriaLabel')}
      className="sticky top-0 z-40 border-b-2 border-outline-variant bg-surface-container-lowest px-4 md:px-6 lg:px-8"
    >
      <div className="flex min-h-14 items-center justify-between gap-3">
        <h1 className="truncate font-headline text-lg font-bold tracking-tight text-on-surface md:text-xl">
          {title}
        </h1>

        <div className="flex shrink-0 items-center gap-2">
          {parentNotifications ? (
            <NotificationBell
              unreadCount={parentNotifications.unreadCount}
              recentNotifications={parentNotifications.recentNotifications}
            />
          ) : null}
        </div>
      </div>
    </header>
  )
}
