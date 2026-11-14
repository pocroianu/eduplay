'use client'

import type { CSSProperties } from 'react'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Avatar,
  Box,
  Button,
  Divider,
  NavLink,
  Paper,
  Stack,
  Text,
  VisuallyHidden,
} from '@mantine/core'
import { createClient } from '@/lib/supabase/client'
import { ROUTES } from '@/shared/lib/constants'
import { getInitials } from '@/shared/lib/utils/initials'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { BottomNavBar } from './BottomNavBar'
import { isNavHrefActive } from './nav-utils'
import { SidebarRail } from '@/shared/components/ui/kit/SidebarRail'
import type { SidebarRailItem, SidebarRailProfile } from '@/shared/components/ui/kit/SidebarRail'
import { AccountMenuModal } from './AccountMenuModal'

export type NavVariant = 'student' | 'teacher' | 'parent' | 'admin'

interface NavItem {
  icon: IconName
  label: string
  labelKey?: string
  href: string
  filled?: boolean
  /** Optional badge text shown next to the label (e.g. "New") */
  badge?: string
  /** Optional notification count badge */
  notificationCount?: number
}

/** Items rendered in the teacher "My Classes" section */
interface ClassItem {
  id: string
  label: string
  /** Two-letter abbreviation for the class avatar */
  initials: string
  href: string
  /** Optional notification count */
  notificationCount?: number
}

interface SideNavBarProps {
  variant: NavVariant
  items: NavItem[]
  /** Optional mobile bottom-nav items. Student mode defaults to the first four primary entries. */
  bottomItems?: NavItem[]
  profile?: {
    full_name: string
    avatar_url?: string | null
  }
  /** Authenticated user role — used to label the profile cluster on standard variants. */
  role?: string
  levelLabel?: string
  /** Teacher classes shown in sidebar "My Classes" section */
  classes?: ClassItem[]
  /** Subtitle shown under profile name (e.g. "Teacher - 1 class") */
  profileSubtitle?: string
}

type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>
type SideNavProfile = NonNullable<SideNavBarProps['profile']>

const imageAvatarStyle: CSSProperties = {
  borderRadius: 999,
  objectFit: 'cover',
}

const standardLogoutButtonStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  color: 'var(--color-on-surface-variant)',
  fontWeight: 650,
}

const standardLogoutButtonCollapsedStyle: CSSProperties = {
  ...standardLogoutButtonStyle,
  justifyContent: 'center',
}

const studentRailStyle: CSSProperties = {
  width: 288,
  height: '100vh',
  flexShrink: 0,
  borderRight: '1px solid var(--color-outline-variant)',
  background: 'var(--color-surface-container-lowest)',
  boxShadow: 'var(--shadow-soft-sm)',
}

const studentProfileStyle: CSSProperties = {
  border: '1px solid var(--color-outline-variant)',
  background: 'var(--color-surface-container-lowest)',
  boxShadow: 'var(--shadow-soft-sm)',
}

const studentAvatarOuterStyle: CSSProperties = {
  background: 'var(--color-primary-soft)',
  padding: 4,
}

const studentAvatarInnerStyle: CSSProperties = {
  background: 'var(--color-surface-container-lowest)',
  color: 'var(--color-primary)',
  fontSize: 28,
  fontWeight: 800,
}

const studentNavStyle: StyleWithVars = {
  minHeight: 64,
  borderRadius: 24,
  color: 'var(--color-on-surface-variant)',
  fontSize: 16,
  fontWeight: 700,
  '--nl-hover': 'var(--color-surface-container)',
}

const studentNavActiveStyle: StyleWithVars = {
  ...studentNavStyle,
  color: 'var(--color-primary-deep)',
  boxShadow: 'var(--shadow-soft-sm)',
  '--nl-bg': 'var(--color-primary-soft)',
  '--nl-color': 'var(--color-primary-deep)',
}

const studentLogoutStyle: CSSProperties = {
  minHeight: 64,
  borderRadius: 24,
  justifyContent: 'flex-start',
  color: 'var(--color-coral)',
  fontWeight: 700,
}

const studentFirstNameFallback = 'exploratorule'

function translateNavItem(item: NavItem, t: TFunction<'common'>): NavItem {
  return {
    ...item,
    label: item.labelKey ? t(item.labelKey, { defaultValue: item.label }) : item.label,
  }
}

function buildRailProfile({
  profile,
  roleLabel,
  fallback,
}: {
  profile?: SideNavProfile
  roleLabel?: string
  fallback: string
}): SidebarRailProfile | undefined {
  if (!profile) return undefined

  return {
    name: profile.full_name || fallback,
    subtitle: roleLabel,
    initials: getInitials(profile.full_name),
    avatar: profile.avatar_url ? (
      <Image
        src={profile.avatar_url}
        alt={profile.full_name}
        width={36}
        height={36}
        style={imageAvatarStyle}
      />
    ) : undefined,
  }
}

function buildRailNavItems(items: NavItem[], pathname: string | null): SidebarRailItem[] {
  return items.map((item) => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
    active: isNavHrefActive(pathname, item.href),
    badge: item.badge,
    dot: item.filled || (item.notificationCount != null && item.notificationCount > 0),
  }))
}

function buildClassRailItems({
  variant,
  classes,
  pathname,
  t,
}: {
  variant: NavVariant
  classes?: ClassItem[]
  pathname: string | null
  t: TFunction<'common'>
}): SidebarRailItem[] {
  if (variant !== 'teacher') return []
  if (!classes || classes.length === 0) {
    return [
      {
        href: ROUTES.TEACHER.CLASSES,
        label: t('nav.teacher.classes', { defaultValue: 'Clasele mele' }),
        icon: 'Users',
        active: isNavHrefActive(pathname, ROUTES.TEACHER.CLASSES),
      },
    ]
  }

  return classes.map((item) => ({
    href: item.href,
    label: item.label,
    icon: 'Users',
    initials: item.initials,
    active: isNavHrefActive(pathname, item.href),
    dot: item.notificationCount != null && item.notificationCount > 0,
  }))
}

function buildUtilityRailItems(variant: NavVariant, t: TFunction<'common'>): SidebarRailItem[] {
  if (variant !== 'teacher') return []

  return [
    { href: ROUTES.TEACHER.SCAN, label: t('shell.sidebar.scan', { defaultValue: 'Scanare' }), icon: 'CornersOut' },
    { href: ROUTES.TEACHER.HELP, label: t('shell.sidebar.help', { defaultValue: 'Ajutor' }), icon: 'Question' },
  ]
}

function StandardLogoutButton({
  collapsed,
  label,
  onLogout,
}: {
  collapsed: boolean
  label: string
  onLogout: () => void | Promise<void>
}) {
  return (
    <Button
      type="button"
      variant="subtle"
      fullWidth
      onClick={onLogout}
      aria-label={label}
      leftSection={<Icon name="SignOut" size="sm" aria-hidden />}
      style={collapsed ? standardLogoutButtonCollapsedStyle : standardLogoutButtonStyle}
    >
      {collapsed ? <VisuallyHidden>{label}</VisuallyHidden> : label}
    </Button>
  )
}

function StandardSideNav({
  variant,
  translatedItems,
  translatedBottomItems,
  classes,
  profile,
  roleLabel,
  pathname,
  collapsed,
  accountMenuOpen,
  accountFallback,
  signOutLabel,
  onToggleCollapsed,
  onToggleAccountMenu,
  onCloseAccountMenu,
  onLogout,
  t,
}: {
  variant: NavVariant
  translatedItems: NavItem[]
  translatedBottomItems: NavItem[]
  classes?: ClassItem[]
  profile?: SideNavProfile
  roleLabel?: string
  pathname: string | null
  collapsed: boolean
  accountMenuOpen: boolean
  accountFallback: string
  signOutLabel: string
  onToggleCollapsed: () => void
  onToggleAccountMenu: () => void
  onCloseAccountMenu: () => void
  onLogout: () => void | Promise<void>
  t: TFunction<'common'>
}) {
  const railProfile = buildRailProfile({ profile, roleLabel, fallback: accountFallback })

  return (
    <>
      <Box
        visibleFrom="md"
        pos="relative"
        data-testid="sidebar"
        data-nav-variant={variant}
        data-collapsed={collapsed ? 'true' : undefined}
      >
        <SidebarRail
          brandLabel="EduPlay"
          collapsed={collapsed}
          profile={railProfile}
          navItems={buildRailNavItems(translatedItems, pathname)}
          classItems={buildClassRailItems({ variant, classes, pathname, t })}
          utilityItems={buildUtilityRailItems(variant, t)}
          onToggleCollapsed={onToggleCollapsed}
          onProfileClick={variant === 'teacher' && profile ? onToggleAccountMenu : undefined}
        />
        {variant !== 'teacher' ? (
          <Box pos="absolute" bottom={16} left={12} right={12}>
            <StandardLogoutButton collapsed={collapsed} label={signOutLabel} onLogout={onLogout} />
          </Box>
        ) : null}
      </Box>

      {variant === 'teacher' && profile ? (
        <AccountMenuModal
          opened={accountMenuOpen}
          onClose={onCloseAccountMenu}
          profile={profile}
          roleLabel={roleLabel}
          placement="desktop"
        />
      ) : null}
      <BottomNavBar items={translatedBottomItems} mode="standard" />
    </>
  )
}

function StudentSideNav({
  translatedItems,
  translatedBottomItems,
  profile,
  levelLabel,
  pathname,
  signOutLabel,
  onLogout,
}: {
  translatedItems: NavItem[]
  translatedBottomItems: NavItem[]
  profile?: SideNavProfile
  levelLabel?: string
  pathname: string | null
  signOutLabel: string
  onLogout: () => void | Promise<void>
}) {
  const firstName = profile?.full_name?.split(' ')[0] ?? studentFirstNameFallback

  return (
    <>
      <Box
        component="aside"
        visibleFrom="md"
        display="flex"
        style={studentRailStyle}
        data-testid="side-nav"
        data-nav-variant="student"
      >
        <Stack h="100%" gap="md" p="md">
          <Paper radius={24} p="md" style={studentProfileStyle}>
            <Stack align="center" gap="xs">
              <Avatar radius="xl" size={80} style={studentAvatarOuterStyle}>
                <Avatar radius="xl" size={72} style={studentAvatarInnerStyle}>
                  {profile?.avatar_url ? (
                    <Image src={profile.avatar_url} alt={profile.full_name} width={72} height={72} style={imageAvatarStyle} />
                  ) : (
                    profile?.full_name?.charAt(0) ?? '?'
                  )}
                </Avatar>
              </Avatar>
              <Text component="h2" ta="center" size="lg" fw={800} style={{ color: 'var(--color-primary)' }}>
                Salut, {firstName}!
              </Text>
              {levelLabel ? (
                <Text size="sm" fw={800} tt="uppercase" ta="center" style={{ color: 'var(--color-on-surface-variant)', letterSpacing: '0.12em' }}>
                  {levelLabel}
                </Text>
              ) : null}
            </Stack>
          </Paper>

          <Stack component="nav" aria-label="Navigare principală" gap={6}>
            {translatedItems.map((item) => {
              const isActive = isNavHrefActive(pathname, item.href)
              return (
                <NavLink
                  component={Link}
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  active={isActive}
                  noWrap
                  label={item.label}
                  leftSection={<Icon name={item.icon} weight={isActive || item.filled ? 'fill' : 'regular'} aria-hidden />}
                  style={isActive ? studentNavActiveStyle : studentNavStyle}
                />
              )
            })}
          </Stack>

          <Box mt="auto">
            <Divider mb="sm" color="var(--color-outline-variant)" />
            <Button
              type="button"
              variant="subtle"
              fullWidth
              onClick={onLogout}
              leftSection={<Icon name="SignOut" aria-hidden />}
              style={studentLogoutStyle}
            >
              {signOutLabel}
            </Button>
          </Box>
        </Stack>
      </Box>
      <BottomNavBar items={translatedBottomItems} mode="kid" />
    </>
  )
}

export function SideNavBar({
  variant,
  items,
  bottomItems,
  profile,
  role,
  levelLabel,
  classes,
  profileSubtitle,
}: SideNavBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation('common')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)

  const translatedItems = items.map((item) => translateNavItem(item, t))
  const translatedBottomItems = (bottomItems ?? (variant === 'student' ? items.slice(0, 4) : items)).map(
    (item) => translateNavItem(item, t),
  )

  const handleLogout = async () => {
    await createClient().auth.signOut()
    router.push(ROUTES.AUTH.LOGIN)
    router.refresh()
  }

  if (variant !== 'student') {
    const roleLabel = profileSubtitle ?? (role ? t(`roles.${role}`, { defaultValue: role }) : undefined)
    return (
      <StandardSideNav
        variant={variant}
        translatedItems={translatedItems}
        translatedBottomItems={translatedBottomItems}
        classes={classes}
        profile={profile}
        roleLabel={roleLabel}
        pathname={pathname}
        collapsed={isCollapsed}
        accountMenuOpen={isAccountMenuOpen}
        accountFallback={t('shell.accountFallback', { defaultValue: 'Utilizator' })}
        signOutLabel={t('shell.sidebar.signOut', { defaultValue: 'Deconectare' })}
        onToggleCollapsed={() => setIsCollapsed((current) => !current)}
        onToggleAccountMenu={() => setIsAccountMenuOpen((current) => !current)}
        onCloseAccountMenu={() => setIsAccountMenuOpen(false)}
        onLogout={handleLogout}
        t={t}
      />
    )
  }

  return (
    <StudentSideNav
      translatedItems={translatedItems}
      translatedBottomItems={translatedBottomItems}
      profile={profile}
      levelLabel={levelLabel}
      pathname={pathname}
      signOutLabel={t('shell.sidebar.signOut', { defaultValue: 'Deconectare' })}
      onLogout={handleLogout}
    />
  )
}
