import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/shared/lib/constants'
import { getAdminOverviewSnapshot } from '@/features/admin/queries'
import { AdminPageHeader } from '@/features/admin/components/overview/AdminPageHeader'
import { AdminStatStrip } from '@/features/admin/components/overview/AdminStatStrip'
import { AdminActivityFeed } from '@/features/admin/components/overview/AdminActivityFeed'
import { AdminQuickShortcuts } from '@/features/admin/components/overview/AdminQuickShortcuts'
import { AdminRecentReleases } from '@/features/admin/components/overview/AdminRecentReleases'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const fullName = profile?.full_name ?? 'Administrator'
  const snapshot = await getAdminOverviewSnapshot(supabase)

  return (
    <div data-testid="admin-overview-page">
      <AdminPageHeader fullName={fullName} />

      <AdminStatStrip snapshot={snapshot} />

      <div className="grid gap-6 xl:grid-cols-[1.72fr_360px]">
        <div className="flex flex-col gap-6 min-w-0">
          <AdminActivityFeed entries={snapshot.recentAuditEntries} />
          <AdminQuickShortcuts />
        </div>
        <aside className="flex flex-col gap-6 min-w-0">
          <AdminRecentReleases changes={snapshot.recentFlagChanges} />
        </aside>
      </div>
    </div>
  )
}
