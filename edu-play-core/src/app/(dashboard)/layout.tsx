import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/shared/lib/constants'
import { NotificationBell } from '@/features/parent-portal'
import { getNotifications, getUnreadNotificationCount } from '@/features/parent-portal/server'
import { SideNavBar } from '@/shared/components/layout/SideNavBar'
import { TopAppBar } from '@/shared/components/layout/TopAppBar'
import { ROLE_NAV_CONFIG } from '@/config/navigation'
import { ToastProvider } from '@/shared/components/ui/kit'

import { pathOwnsShell } from './path-owns-shell'

function sidebarClassInitials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase('ro-RO') ?? '')
      .join('') || '?'
  )
}

function teacherClassCountLabel(count: number) {
  if (count === 1) return 'Profesor - o clasă'
  return `Profesor - ${count} clase`
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, avatar_url')
    .eq('id', user.id)
    .single()

  if (error) {
    throw error
  }

  if (!profile) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const navConfig = ROLE_NAV_CONFIG[profile.role]

  if (!navConfig) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const pathname = (await headers()).get('x-pathname')

  if (pathOwnsShell(pathname)) {
    return <ToastProvider>{children}</ToastProvider>
  }

  const parentNotifications =
    profile.role === 'parent'
      ? await Promise.all([
          getUnreadNotificationCount(user.id),
          getNotifications(user.id, 5, 0),
        ]).then(([unreadCount, notificationData]) => ({
          unreadCount,
          recentNotifications: notificationData.notifications,
        }))
      : undefined

  const teacherSidebarClasses =
    profile.role === 'teacher'
      ? await supabase
          .from('classes')
          .select('id, name')
          .eq('teacher_id', user.id)
          .order('is_active', { ascending: false })
          .order('name', { ascending: true })
          .limit(8)
      : { data: null }

  const teacherClassItems =
    profile.role === 'teacher'
      ? (teacherSidebarClasses.data ?? []).map((classItem) => ({
          id: classItem.id,
          label: classItem.name,
          initials: sidebarClassInitials(classItem.name),
          href: ROUTES.TEACHER.CLASS(classItem.id),
        }))
      : undefined

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-surface">
        <SideNavBar
          variant={navConfig.variant}
          items={navConfig.items}
          bottomItems={navConfig.bottomNavItems}
          role={profile.role}
          profile={{
            full_name: profile.full_name ?? '',
            avatar_url: profile.avatar_url,
          }}
          profileSubtitle={profile.role === 'teacher' ? teacherClassCountLabel(teacherClassItems?.length ?? 0) : undefined}
          classes={teacherClassItems}
        />
        <div className="flex min-w-0 flex-1 flex-col bg-surface pb-28 md:pb-0">
          <TopAppBar
            mode={navConfig.variant === 'student' ? 'kid' : 'standard'}
            role={profile.role}
            profile={{
              full_name: profile.full_name ?? '',
              avatar_url: profile.avatar_url,
              subtitle: profile.email,
            }}
            notificationSlot={
              parentNotifications ? (
                <NotificationBell
                  unreadCount={parentNotifications.unreadCount}
                  recentNotifications={parentNotifications.recentNotifications}
                />
              ) : undefined
            }
          />
          {children}
        </div>
      </div>
    </ToastProvider>
  )
}
