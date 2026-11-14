import {
  AdminUsersTable,
  PageHeader,
  StatStrip,
  type StatStripItem,
} from '@/features/admin'
import {
  ADMIN_USER_ROLES,
  type AdminUserSummary,
} from '@/features/admin/api/schemas'
import { createClient } from '@/lib/supabase/server'
import { encodeCursor } from '@/lib/api/cursor'

export const metadata = {
  title: 'Utilizatori — Administrare',
}

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
  role: (typeof ADMIN_USER_ROLES)[number]
  status: 'active' | 'suspended'
  created_at: string
}

export default async function AdminUsersPage() {
  // Auth + role gating live in `/admin/layout.tsx` — this page only owns
  // the user-management content.
  const supabase = await createClient()

  const fetchLimit = PAGE_SIZE + 1

  const [pageResult, activeResult, suspendedResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, role, status, created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(fetchLimit),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'suspended'),
  ])

  if (pageResult.error) {
    console.error('Eroare la încărcarea utilizatorilor:', pageResult.error)
  }

  const rows = (pageResult.data ?? []) as ProfileRow[]
  const hasMore = rows.length > PAGE_SIZE
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows
  const last = page.at(-1)
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null

  const initialUsers: AdminUserSummary[] = page.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? '—',
    role: row.role,
    status: row.status,
    lastSignInAt: null,
    createdAt: row.created_at,
  }))

  const activeCount = activeResult.count ?? 0
  const suspendedCount = suspendedResult.count ?? 0

  const stats: StatStripItem[] = [
    {
      key: 'total',
      label: 'Conturi totale',
      value: activeCount + suspendedCount,
      icon: 'Users',
      hint: 'Profesori, părinți, elevi și administratori',
    },
    {
      key: 'active',
      label: 'Active',
      value: activeCount,
      icon: 'UserPlus',
      hint: 'Pot accesa platforma',
    },
    {
      key: 'suspended',
      label: 'Suspendate',
      value: suspendedCount,
      icon: 'UserMinus',
      hint: suspendedCount > 0 ? 'Login blocat la nivelul auth' : 'Niciun cont suspendat',
    },
    {
      key: 'roles',
      label: 'Roluri folosite',
      value: ADMIN_USER_ROLES.length,
      icon: 'IdentificationBadge',
      hint: 'Profesor, părinte, elev, administrator',
    },
  ]

  return (
    <div data-testid="admin-users-page" className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Administrare"
        title="Utilizatori"
        description="Gestionează profesori, părinți, elevi și administratori. Acțiuni: suspendă, resetează credențiale, inițiază ștergere."
      />

      <StatStrip items={stats} />

      <AdminUsersTable
        initialUsers={initialUsers}
        initialNextCursor={nextCursor}
        totals={{ active: activeCount, suspended: suspendedCount }}
      />
    </div>
  )
}
