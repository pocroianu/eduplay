'use client'

import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils/cn'
import { TopAppBar } from '@/shared/components/layout/TopAppBar'
import { SideNavBar } from '@/shared/components/layout/SideNavBar'
import type { IconName } from '@/shared/components/ui/Icon.registry'

export type DashboardShellVariant = 'student' | 'teacher' | 'admin'

export interface DashboardShellNavItem {
  icon: IconName
  label: string
  href: string
  filled?: boolean
}

export interface DashboardShellTabItem {
  label: string
  href: string
  active?: boolean
}

export interface DashboardShellProfile {
  full_name: string
  avatar_url?: string | null
  subtitle?: string
}

export interface DashboardShellProps {
  /** Student renders in kid mode; teacher/admin render in standard mode. */
  variant: DashboardShellVariant
  profile?: DashboardShellProfile
  /**
   * If provided, DashboardShell renders its own SideNavBar (which also mounts
   * BottomNavBar on mobile). Leave undefined when the parent route group
   * layout already renders the side navigation — the shell will only emit
   * TopAppBar + main content in that case.
   */
  navItems?: DashboardShellNavItem[]
  /** Optional mobile bottom-nav items; student mode defaults to the first four primary entries. */
  bottomNavItems?: DashboardShellNavItem[]
  /** Optional level label shown under the student side-nav avatar. */
  levelLabel?: string
  /** TopAppBar configuration. Omit to skip the top bar entirely. */
  topBar?: {
    title?: string
    showLogo?: boolean
    tabs?: DashboardShellTabItem[]
    badge?: { label: string; className?: string }
    /** Slot rendered inside the TopAppBar (e.g. a right-side action cluster). */
    children?: ReactNode
  }
  /** Max-width + padding override for the main content column. */
  contentClassName?: string
  /** Optional root wrapper class (e.g., custom background). */
  className?: string
  children: ReactNode
}

/**
 * DashboardShell — the unified chrome used by every student + teacher
 * dashboard surface. Composes the existing `TopAppBar` / `SideNavBar` /
 * `BottomNavBar` primitives per the EDU-45 design-spec §4 rules so every
 * route inherits the same responsive layout without duplicating markup.
 */
export function DashboardShell({
  variant,
  profile,
  navItems,
  bottomNavItems,
  levelLabel,
  topBar,
  contentClassName,
  className,
  children,
}: DashboardShellProps) {
  const includeSideNav = Array.isArray(navItems) && navItems.length > 0
  const isStandard = variant === 'teacher' || variant === 'admin'
  const topBarMode = isStandard ? 'standard' : 'kid'

  const shell = (
    <div className={cn('flex min-w-0 flex-1 flex-col bg-surface pb-28 md:pb-0', !includeSideNav && 'min-h-screen')}>
      {topBar ? (
        <TopAppBar
          title={topBar.title}
          showLogo={topBar.showLogo}
          tabs={topBar.tabs}
          badge={topBar.badge}
          profile={profile}
          mode={topBarMode}
          role={variant}
        >
          {topBar.children}
        </TopAppBar>
      ) : null}
      <div
        data-testid="dashboard-shell-content"
        className={cn(
          'mx-auto w-full flex-1 overflow-y-auto bg-surface px-4 py-6 pb-28 md:px-8 md:pb-12',
          contentClassName ?? 'max-w-6xl',
        )}
      >
        {children}
      </div>
    </div>
  )

  if (!includeSideNav) return shell

  return (
    <div className={cn('flex min-h-screen bg-surface', className)} data-shell-variant={variant}>
      <SideNavBar
        variant={variant}
        items={navItems!}
        bottomItems={bottomNavItems}
        profile={
          profile
            ? {
                full_name: profile.full_name,
                avatar_url: profile.avatar_url ?? null,
              }
            : undefined
        }
        levelLabel={levelLabel}
      />
      {shell}
    </div>
  )
}
