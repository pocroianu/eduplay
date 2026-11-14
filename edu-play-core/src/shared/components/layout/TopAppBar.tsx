'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ActionIcon, Box, Button, Group, Text, ThemeIcon } from '@mantine/core'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { createClient } from '@/lib/supabase/client'
import { ROUTES } from '@/shared/lib/constants'
import { cn } from '@/shared/lib/utils/cn'
import { getInitials } from '@/shared/lib/utils/initials'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { PageHeader } from '@/shared/components/ui/kit/PageHeader'
import { Popup, PopupRow } from '@/shared/components/ui/kit/Popup'
import topbarClasses from './TopAppBar.module.css'
import { AccountMenuModal } from './AccountMenuModal'

interface TopAppBarProps {
  title?: string
  showLogo?: boolean
  /** Visual register: `kid` for student surfaces, `standard` for teacher/parent/admin. */
  mode?: 'kid' | 'standard'
  role?: string
  tabs?: Array<{ label: string; href: string; active?: boolean }>
  profile?: {
    full_name: string
    avatar_url?: string | null
    subtitle?: string
  }
  badge?: { label: string; className?: string }
  /** Optional caller-controlled notification surface — rendered on the right when present. */
  notificationSlot?: React.ReactNode
  children?: React.ReactNode
}

const navLinkFocusClass =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

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

const teacherCreationLinks: Array<{ href: string; icon: IconName; labelKey: string; fallback: string }> = [
  { href: ROUTES.TEACHER.CLASSES, icon: 'BookOpen', labelKey: 'shell.createMenu.postToJournal', fallback: 'Alege clasa pentru postare' },
  { href: ROUTES.TEACHER.ACTIVITIES, icon: 'Lightning', labelKey: 'shell.createMenu.assignActivity', fallback: 'Atribuie o activitate' },
  { href: ROUTES.TEACHER.ACTIVITY_CREATE, icon: 'PlusCircle', labelKey: 'shell.createMenu.createActivity', fallback: 'Creează activitate' },
  { href: ROUTES.TEACHER.ACTIVITY_GENERATE, icon: 'Sparkle', labelKey: 'shell.createMenu.generateActivity', fallback: 'Generează activitate' },
]

function LibraryChromeTitle({
  icon,
  title,
  testId,
  className,
}: {
  icon: IconName
  title: string
  testId?: string
  className?: string
}) {
  return (
    <Group className={cn(topbarClasses.libraryTitle, className)} wrap="nowrap">
      <ThemeIcon className={topbarClasses.libraryTitleIcon} size={36} radius={10} variant="light">
        <span data-testid={testId} aria-hidden="true">
          <Icon name={icon} size={20} weight="bold" aria-hidden />
        </span>
      </ThemeIcon>
      <Text component="h1" className={topbarClasses.libraryTitleText}>
        {title}
      </Text>
    </Group>
  )
}

function LibrarySourceTab({
  href,
  active,
  children,
  icon,
  className,
  selectedClassName,
}: {
  href: string
  active: boolean
  children: string
  icon?: ReactNode
  className?: string
  selectedClassName?: string
}) {
  return (
    <Button
      component={Link}
      href={href}
      aria-current={active ? 'page' : undefined}
      variant="transparent"
      size="sm"
      leftSection={icon}
      classNames={{
        root: cn(
          topbarClasses.libraryTab,
          className,
          active && topbarClasses.libraryTabSelected,
          active && selectedClassName,
        ),
      }}
    >
      {children}
    </Button>
  )
}

function LibraryCreateAction({
  label,
  className,
  icon,
  iconTestId,
}: {
  label: string
  className?: string
  icon?: IconName
  iconTestId?: string
}) {
  return (
    <Button
      component={Link}
      href={ROUTES.TEACHER.ACTIVITY_CREATE}
      variant="transparent"
      leftSection={
        icon ? (
          <span data-testid={iconTestId} aria-hidden="true">
            <Icon name={icon} size={18} weight="fill" aria-hidden />
          </span>
        ) : undefined
      }
      classNames={{ root: cn(topbarClasses.libraryPrimaryAction, className) }}
    >
      {label}
    </Button>
  )
}

function titleKeyForPath(pathname: string | null): string | null {
  if (!pathname) return null
  for (const [pattern, key] of PATH_TITLE_KEYS) {
    if (pattern.test(pathname)) return key
  }
  return null
}

type TopAppBarProfile = NonNullable<TopAppBarProps['profile']>
type TopAppBarTab = NonNullable<TopAppBarProps['tabs']>[number]

interface CreationMenuItem {
  href: string
  icon: IconName
  label: string
}

interface ShellMenuLabels {
  accountFallback: string
  createButton: string
  createTitle: string
  signOut: string
  accountMenuButton: string
  accountMenuTitle: string
  userFallback: string
}

interface TopAppBarChromeState {
  isTeacherHome: boolean
  isTeacherLibrary: boolean
  isTeacherLibrariesExplore: boolean
  isTeacherReferenceChrome: boolean
  shouldShowTeacherUtilityMenu: boolean
  activeLibrarySource: 'seesaw' | 'community'
  resolvedTitle: string
}

function ShellLogoutButton({ label, onLogout }: { label: string; onLogout: () => void | Promise<void> }) {
  return (
    <Button
      type="button"
      onClick={onLogout}
      variant="subtle"
      color="red"
      fullWidth
      justify="flex-start"
      leftSection={<Icon name="SignOut" size="sm" aria-hidden />}
      className={cn(
        'min-h-11 rounded-md px-3 py-2 text-left text-sm font-semibold text-error transition-colors hover:bg-error/10',
        navLinkFocusClass,
      )}
    >
      <span>{label}</span>
    </Button>
  )
}

function MobileTeacherCreateMenu({
  opened,
  onToggle,
  onClose,
  onNavigate,
  onLogout,
  profile,
  items,
  labels,
}: {
  opened: boolean
  onToggle: () => void
  onClose: () => void
  onNavigate: (href: string) => void
  onLogout: () => void | Promise<void>
  profile?: TopAppBarProfile
  items: CreationMenuItem[]
  labels: ShellMenuLabels
}) {
  return (
    <div className="relative md:hidden">
      <ActionIcon
        type="button"
        aria-expanded={opened}
        aria-haspopup="dialog"
        aria-label={labels.createButton}
        onClick={onToggle}
        variant="default"
        size={44}
        radius="xl"
        className={cn(
          'border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface',
          navLinkFocusClass,
        )}
      >
        <Icon name="PlusCircle" aria-hidden />
      </ActionIcon>

      {opened ? (
        <Popup open={opened} onClose={onClose} variant="modal" size="sm" title={labels.createTitle}>
          {profile ? (
            <div className="mb-3 border-b border-outline-variant pb-3">
              <p className="truncate text-sm font-bold text-on-surface">
                {profile.full_name || labels.accountFallback}
              </p>
              {profile.subtitle ? <p className="mt-0.5 truncate text-xs text-on-surface-variant">{profile.subtitle}</p> : null}
            </div>
          ) : null}

          <nav aria-label={labels.createTitle} className="space-y-1">
            {items.map((item) => (
              <PopupRow
                key={item.href}
                label={item.label}
                icon={item.icon}
                onClick={() => {
                  onClose()
                  onNavigate(item.href)
                }}
              />
            ))}
          </nav>

          <div className="mt-3 border-t border-outline-variant pt-3">
            <ShellLogoutButton label={labels.signOut} onLogout={onLogout} />
          </div>
        </Popup>
      ) : null}
    </div>
  )
}

function MobileStandardAccountMenu({
  opened,
  onToggle,
  onClose,
  onLogout,
  profile,
  role,
  roleLabel,
  labels,
}: {
  opened: boolean
  onToggle: () => void
  onClose: () => void
  onLogout: () => void | Promise<void>
  profile: TopAppBarProfile
  role?: string
  roleLabel?: string
  labels: ShellMenuLabels
}) {
  return (
    <div className="relative md:hidden">
      <ActionIcon
        type="button"
        aria-expanded={opened}
        aria-haspopup="dialog"
        aria-label={labels.accountMenuButton}
        onClick={onToggle}
        variant="default"
        size={44}
        radius="xl"
        className={cn(
          'border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface',
          navLinkFocusClass,
        )}
      >
        {profile.avatar_url ? (
          <Image src={profile.avatar_url} alt={profile.full_name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="text-sm font-semibold">{getInitials(profile.full_name)}</span>
        )}
      </ActionIcon>

      {opened && role === 'teacher' ? (
        <AccountMenuModal
          opened={opened}
          onClose={onClose}
          profile={profile}
          roleLabel={roleLabel}
          placement="mobile"
        />
      ) : null}

      {opened && role !== 'teacher' ? (
        <Popup open={opened} onClose={onClose} variant="modal" size="sm" title={labels.accountMenuTitle}>
          <div className="mb-3 border-b border-outline-variant pb-3">
            <p className="truncate text-sm font-bold text-on-surface">
              {profile.full_name || labels.userFallback}
            </p>
            {profile.subtitle ? <p className="mt-0.5 truncate text-xs text-on-surface-variant">{profile.subtitle}</p> : null}
          </div>
          <ShellLogoutButton label={labels.signOut} onLogout={onLogout} />
        </Popup>
      ) : null}
    </div>
  )
}

function TeacherHomeChrome({ title, label }: { title: string; label: string }) {
  return (
    <header
      aria-label={label}
      className="flex h-[68px] items-center justify-center border-b border-outline bg-surface-container-lowest px-6"
    >
      <h1 className="truncate text-center font-headline text-xl font-bold tracking-tight text-on-surface">
        {title}
      </h1>
    </header>
  )
}

function TeacherLibrariesExploreChrome({
  label,
  title,
  createLabel,
  activeLibrarySource,
}: {
  label: string
  title: string
  createLabel: string
  activeLibrarySource: 'seesaw' | 'community'
}) {
  return (
    <Box component="header" aria-label={label} h={98} className={topbarClasses.libraryTopbar}>
      <Group
        className={cn(topbarClasses.libraryTopbarContent, topbarClasses.libraryExploreTopbarContent)}
        wrap="nowrap"
      >
        <LibraryChromeTitle
          icon="Compass"
          title={title}
          testId="libraries-explore-title-icon"
          className={topbarClasses.libraryExploreTitle}
        />

        <Box
          component="nav"
          className={cn(topbarClasses.libraryTabs, topbarClasses.libraryExploreTabs)}
          aria-label="Surse bibliotecă"
        >
          <LibrarySourceTab
            href={ROUTES.TEACHER.LIBRARIES_EXPLORE}
            active={activeLibrarySource === 'seesaw'}
            className={topbarClasses.libraryExploreTab}
            selectedClassName={topbarClasses.libraryExploreTabSelected}
            icon={<SeesawLibraryIcon />}
          >
            Biblioteca Seesaw
          </LibrarySourceTab>
          <LibrarySourceTab
            href={`${ROUTES.TEACHER.LIBRARIES_EXPLORE}?source=community`}
            active={activeLibrarySource === 'community'}
            className={topbarClasses.libraryExploreTab}
            selectedClassName={topbarClasses.libraryExploreTabSelected}
            icon={<CommunityLibraryIcon />}
          >
            Biblioteca comunității
          </LibrarySourceTab>
        </Box>

        <LibraryCreateAction
          label={createLabel}
          className={topbarClasses.libraryExploreAction}
          icon="Lightbulb"
          iconTestId="libraries-create-action-icon"
        />
      </Group>
    </Box>
  )
}

function SeesawLibraryIcon() {
  return (
    <span
      className={cn(topbarClasses.libraryTabIcon, topbarClasses.librarySeesawIcon)}
      data-testid="libraries-seesaw-tab-icon"
      aria-hidden="true"
    >
      S
    </span>
  )
}

function CommunityLibraryIcon() {
  return (
    <span className={topbarClasses.libraryTabIcon} data-testid="libraries-community-tab-icon" aria-hidden="true">
      <Icon name="Users" size={20} weight="fill" aria-hidden />
    </span>
  )
}

function TeacherLibraryChrome({ label, title, createLabel }: { label: string; title: string; createLabel: string }) {
  return (
    <Box component="header" aria-label={label} h={68} className={topbarClasses.libraryTopbar}>
      <Group className={topbarClasses.libraryTopbarContent} justify="space-between" wrap="nowrap">
        <LibraryChromeTitle icon="BookOpen" title={title} />
        <LibraryCreateAction label={createLabel} />
      </Group>
    </Box>
  )
}

function StandardTopAppBar({
  isTeacherHome,
  isTeacherLibrariesExplore,
  isTeacherLibrary,
  label,
  resolvedTitle,
  activeLibrarySource,
  badge,
  action,
  showLogo,
  teacherLibraryTitle,
  teacherLibrariesExploreTitle,
  createLabel,
}: {
  isTeacherHome: boolean
  isTeacherLibrariesExplore: boolean
  isTeacherLibrary: boolean
  label: string
  resolvedTitle: string
  activeLibrarySource: 'seesaw' | 'community'
  badge?: TopAppBarProps['badge']
  action?: ReactNode
  showLogo: boolean
  teacherLibraryTitle: string
  teacherLibrariesExploreTitle: string
  createLabel: string
}) {
  if (isTeacherHome) {
    return <TeacherHomeChrome label={label} title={resolvedTitle} />
  }

  if (isTeacherLibrariesExplore) {
    return (
      <TeacherLibrariesExploreChrome
        label={label}
        title={teacherLibrariesExploreTitle}
        createLabel={createLabel}
        activeLibrarySource={activeLibrarySource}
      />
    )
  }

  if (isTeacherLibrary) {
    return <TeacherLibraryChrome label={label} title={teacherLibraryTitle} createLabel={createLabel} />
  }

  const headerTitle = showLogo
    ? `EduPlay${resolvedTitle ? ` · ${resolvedTitle}` : ''}`
    : resolvedTitle || 'EduPlay'

  return <PageHeader title={headerTitle} eyebrow={badge?.label} action={action} />
}

function KidTopAppBar({
  label,
  showLogo,
  resolvedTitle,
  badge,
  tabs,
  mode,
  isTeacherHome,
  children,
  notificationSlot,
  mobileTeacherCreateMenu,
  shouldRenderProfile,
  profile,
}: {
  label: string
  showLogo: boolean
  resolvedTitle: string
  badge?: TopAppBarProps['badge']
  tabs?: TopAppBarTab[]
  mode: 'kid' | 'standard'
  isTeacherHome: boolean
  children?: React.ReactNode
  notificationSlot?: React.ReactNode
  mobileTeacherCreateMenu?: React.ReactNode
  shouldRenderProfile: boolean
  profile?: TopAppBarProfile
}) {
  return (
    <header
      aria-label={label}
      className="sticky top-0 z-40 border-b border-outline-variant bg-surface-container-lowest shadow-soft-sm"
    >
      <div className="relative flex min-h-16 w-full items-center justify-between gap-3 px-5 py-3 md:px-6">
        <KidHeaderTitle
          showLogo={showLogo}
          resolvedTitle={resolvedTitle}
          badge={badge}
          isTeacherHome={isTeacherHome}
        />
        <KidHeaderTabs tabs={tabs} mode={mode} />
        <div className="flex shrink-0 items-center gap-4">
          {children}
          {notificationSlot}
          {mobileTeacherCreateMenu}
          {shouldRenderProfile && profile ? <KidProfileBadge profile={profile} /> : null}
        </div>
      </div>
    </header>
  )
}

function KidHeaderTitle({
  showLogo,
  resolvedTitle,
  badge,
  isTeacherHome,
}: {
  showLogo: boolean
  resolvedTitle: string
  badge?: TopAppBarProps['badge']
  isTeacherHome: boolean
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-4',
        isTeacherHome && 'pointer-events-none absolute inset-x-16 justify-center text-center',
      )}
    >
      {showLogo ? (
        <span className="shrink-0 font-headline text-2xl font-semibold tracking-tight text-primary">EduPlay</span>
      ) : null}
      {resolvedTitle ? (
        <h1
          className={cn(
            'truncate font-headline tracking-tight text-on-background',
            'text-xl font-semibold',
            isTeacherHome && 'max-w-full text-center',
          )}
        >
          {resolvedTitle}
        </h1>
      ) : null}
      {badge ? (
        <span
          className={`hidden rounded-sm px-2.5 py-1 text-xs font-semibold uppercase tracking-wide lg:inline-block ${
            badge.className ?? 'bg-primary-soft text-primary-deep'
          }`}
        >
          {badge.label}
        </span>
      ) : null}
    </div>
  )
}

function KidHeaderTabs({ tabs, mode }: { tabs?: TopAppBarTab[]; mode: 'kid' | 'standard' }) {
  if (!tabs) return null

  return (
    <nav className={topbarClasses.appTabs}>
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={cn(
            topbarClasses.appTab,
            mode === 'kid' && topbarClasses.appTabKid,
            tab.active && topbarClasses.appTabActive,
            navLinkFocusClass,
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

function KidProfileBadge({ profile }: { profile: TopAppBarProfile }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-container-lowest px-2 py-1.5 shadow-soft-sm">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-semibold leading-none text-on-background">{profile.full_name}</p>
      </div>
      {profile.avatar_url ? (
        <Image src={profile.avatar_url} alt={profile.full_name} width={40} height={40} className="rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary-deep">
          {getInitials(profile.full_name)}
        </div>
      )}
    </div>
  )
}

function teacherPathMatches(role: string | undefined, title: string | undefined, pathname: string | null, pattern: RegExp) {
  return role === 'teacher' && !title && pattern.test(pathname ?? '')
}

function resolveHeaderTitle({
  title,
  isTeacherHome,
  isTeacherLibrary,
  isTeacherLibrariesExplore,
  pathname,
  profile,
  t,
}: {
  title?: string
  isTeacherHome: boolean
  isTeacherLibrary: boolean
  isTeacherLibrariesExplore: boolean
  pathname: string | null
  profile?: TopAppBarProfile
  t: TFunction<'common'>
}) {
  if (title) return title
  if (isTeacherHome && profile?.full_name) {
    return t('shell.pageTitles.teacherWelcome', { name: profile.full_name })
  }
  if (isTeacherHome || isTeacherLibrary || isTeacherLibrariesExplore) return ''

  const titleKey = titleKeyForPath(pathname)

  return titleKey ? t(titleKey) : ''
}

function resolveTopAppBarChromeState({
  title,
  role,
  pathname,
  searchParams,
  profile,
  t,
}: {
  title?: string
  role?: string
  pathname: string | null
  searchParams: URLSearchParams
  profile?: TopAppBarProfile
  t: TFunction<'common'>
}): TopAppBarChromeState {
  const isTeacherHome = teacherPathMatches(role, title, pathname, /^\/teacher\/?$/)
  const isTeacherLibrary = teacherPathMatches(role, title, pathname, /^\/teacher\/library\/?$/)
  const isTeacherLibrariesExplore = teacherPathMatches(role, title, pathname, /^\/teacher\/libraries(?:\/explore)?\/?$/)
  const isTeacherReferenceChrome = isTeacherHome || isTeacherLibrary || isTeacherLibrariesExplore

  return {
    isTeacherHome,
    isTeacherLibrary,
    isTeacherLibrariesExplore,
    isTeacherReferenceChrome,
    shouldShowTeacherUtilityMenu: role === 'teacher',
    activeLibrarySource: searchParams.get('source') === 'community' ? 'community' : 'seesaw',
    resolvedTitle: resolveHeaderTitle({
      title,
      isTeacherHome,
      isTeacherLibrary,
      isTeacherLibrariesExplore,
      pathname,
      profile,
      t,
    }),
  }
}

function buildShellMenuLabels(t: TFunction<'common'>): ShellMenuLabels {
  return {
    accountFallback: t('shell.accountFallback', { defaultValue: 'Profesor' }),
    createButton: t('shell.createMenu.button', { defaultValue: 'Deschide meniul de creare' }),
    createTitle: t('shell.createMenu.title', { defaultValue: 'Creează' }),
    signOut: t('shell.sidebar.signOut', { defaultValue: 'Deconectare' }),
    accountMenuButton: t('shell.sidebar.accountMenuButton', { defaultValue: 'Deschide meniul contului' }),
    accountMenuTitle: t('shell.sidebar.accountMenuTitle', { defaultValue: 'Meniu cont' }),
    userFallback: t('shell.accountFallback', { defaultValue: 'Utilizator' }),
  }
}

function buildCreationMenuItems(t: TFunction<'common'>): CreationMenuItem[] {
  return teacherCreationLinks.map((item) => ({
    href: item.href,
    icon: item.icon,
    label: t(item.labelKey, { defaultValue: item.fallback }),
  }))
}

function resolveTeacherAccountRoleLabel({
  role,
  profile,
  t,
}: {
  role?: string
  profile?: TopAppBarProfile
  t: TFunction<'common'>
}) {
  const profileRoleLabel = profile?.subtitle ?? (role ? t(`roles.${role}`, { defaultValue: role }) : undefined)

  return role === 'teacher' ? t('roles.teacher', { defaultValue: 'Profesor' }) : profileRoleLabel
}

function buildStandardAction({
  children,
  notificationSlot,
  mobileTeacherCreateMenu,
  mobileStandardAccountMenu,
}: {
  children?: React.ReactNode
  notificationSlot?: React.ReactNode
  mobileTeacherCreateMenu?: React.ReactNode
  mobileStandardAccountMenu?: React.ReactNode
}) {
  const hasAction = Boolean(children || notificationSlot || mobileTeacherCreateMenu || mobileStandardAccountMenu)

  if (!hasAction) return undefined

  return (
    <div className="flex shrink-0 items-center gap-2">
      {children}
      {notificationSlot}
      {mobileTeacherCreateMenu}
      {mobileStandardAccountMenu}
    </div>
  )
}

export function TopAppBar({
  title,
  showLogo = false,
  mode = 'kid',
  role,
  tabs,
  profile,
  badge,
  notificationSlot,
  children,
}: TopAppBarProps) {
  const isStandard = mode === 'standard'
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation('common')

  const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false)
  const [isMobileAccountMenuOpen, setIsMobileAccountMenuOpen] = useState(false)
  const chrome = resolveTopAppBarChromeState({ title, role, pathname, searchParams, profile, t })
  const shellMenuLabels = buildShellMenuLabels(t)
  const creationMenuItems = buildCreationMenuItems(t)
  const teacherAccountRoleLabel = resolveTeacherAccountRoleLabel({ role, profile, t })

  const handleLogout = async () => {
    setIsUtilityMenuOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(ROUTES.AUTH.LOGIN)
    router.refresh()
  }

  const mobileTeacherCreateMenu = chrome.shouldShowTeacherUtilityMenu ? (
    <MobileTeacherCreateMenu
      opened={isUtilityMenuOpen}
      onToggle={() => setIsUtilityMenuOpen((current) => !current)}
      onClose={() => setIsUtilityMenuOpen(false)}
      onNavigate={(href) => router.push(href)}
      onLogout={handleLogout}
      profile={profile}
      items={creationMenuItems}
      labels={shellMenuLabels}
    />
  ) : null

  const mobileStandardAccountMenu = isStandard && profile ? (
    <MobileStandardAccountMenu
      opened={isMobileAccountMenuOpen}
      onToggle={() => setIsMobileAccountMenuOpen((current) => !current)}
      onClose={() => setIsMobileAccountMenuOpen(false)}
      onLogout={handleLogout}
      profile={profile}
      role={role}
      roleLabel={teacherAccountRoleLabel}
      labels={shellMenuLabels}
    />
  ) : null

  const standardAction = buildStandardAction({ children, notificationSlot, mobileTeacherCreateMenu, mobileStandardAccountMenu })
  const navbarLabel = t('shell.navbarAriaLabel', {
    defaultValue: isStandard ? 'Antet pagină' : 'Navigare aplicație',
  })

  if (isStandard) {
    return (
      <StandardTopAppBar
        isTeacherHome={chrome.isTeacherHome}
        isTeacherLibrariesExplore={chrome.isTeacherLibrariesExplore}
        isTeacherLibrary={chrome.isTeacherLibrary}
        label={navbarLabel}
        resolvedTitle={chrome.resolvedTitle}
        activeLibrarySource={chrome.activeLibrarySource}
        badge={badge}
        action={standardAction}
        showLogo={showLogo}
        teacherLibraryTitle={t('shell.pageTitles.teacherLibrary', { defaultValue: 'Biblioteca mea' })}
        teacherLibrariesExploreTitle={t('shell.pageTitles.teacherLibrariesExplore', { defaultValue: 'Biblioteci' })}
        createLabel={t('shell.createMenu.createActivity', { defaultValue: 'Creează activitate' })}
      />
    )
  }

  return (
    <KidTopAppBar
      label={navbarLabel}
      showLogo={showLogo}
      resolvedTitle={chrome.resolvedTitle}
      badge={badge}
      tabs={tabs}
      mode={mode}
      isTeacherHome={chrome.isTeacherHome}
      notificationSlot={notificationSlot}
      mobileTeacherCreateMenu={mobileTeacherCreateMenu}
      shouldRenderProfile={Boolean(profile && !chrome.isTeacherReferenceChrome)}
      profile={profile}
    >
      {children}
    </KidTopAppBar>
  )
}
