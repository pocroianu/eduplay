import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/shared/lib/constants'
import { DashboardShell } from '@/shared/components/ui/kit'
import { AdminSearchInput } from '@/features/admin/components/AdminSearchInput'
import { ADMIN_NAV_ITEMS } from '@/features/admin/config'

interface AdminLayoutProps {
  children: ReactNode
}

/**
 * Shared chrome for every `/admin/*` surface — standard-mode side nav, top app bar
 * with search, and the role gate that keeps non-admins out of the console.
 * The layout-level role gate is the visible-to-the-user redirect; the
 * middleware in `src/lib/supabase/middleware.ts` is the authoritative
 * defence-in-depth check enforced at the edge.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect(ROUTES.HOME)
  }

  return (
    <DashboardShell
      variant="admin"
      navItems={ADMIN_NAV_ITEMS.map((item) => ({ ...item }))}
      profile={{
        full_name: profile.full_name ?? 'Administrator',
        avatar_url: profile.avatar_url,
      }}
      topBar={{
        showLogo: true,
        children: <AdminSearchInput />,
      }}
    >
      {children}
    </DashboardShell>
  )
}
