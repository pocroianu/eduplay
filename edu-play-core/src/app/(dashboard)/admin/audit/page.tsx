import {
  AdminAuditTable,
  PageHeader,
  StatStrip,
  type StatStripItem,
} from '@/features/admin'
import { type AdminAuditEntry } from '@/features/admin/api/schemas'
import { createClient } from '@/lib/supabase/server'
import { encodeCursor } from '@/lib/api/cursor'

export const metadata = {
  title: 'Jurnal de audit — Administrare',
}

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function lastSevenDaysIso(): string {
  return new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
}

interface AuditRow {
  id: string
  changed_by: string | null
  action: string | null
  table_name: string | null
  record_id: string | null
  resource_id_text: string | null
  old_data: unknown
  new_data: unknown
  visibility: string | null
  changed_at: string
}

export default async function AdminAuditPage() {
  // Auth + role gating live in `/admin/layout.tsx` — this page only owns
  // the audit-log content.
  const supabase = await createClient()

  const fetchLimit = PAGE_SIZE + 1
  const sevenDaysAgoIso = lastSevenDaysIso()

  const [pageResult, weekCountResult, platformCountResult] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id, changed_by, action, table_name, record_id, resource_id_text, old_data, new_data, visibility, changed_at')
      .order('changed_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(fetchLimit),
    supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .gte('changed_at', sevenDaysAgoIso),
    supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('visibility', 'platform'),
  ])

  if (pageResult.error) {
    console.error('Eroare la încărcarea jurnalului de audit:', pageResult.error)
  }

  const rows = (pageResult.data ?? []) as AuditRow[]
  const hasMore = rows.length > PAGE_SIZE
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows
  const last = page.at(-1)
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.changed_at, id: String(last.id) })
      : null

  // Batch lookup actor names — keyed by uuid
  const actorIds = Array.from(
    new Set(page.map((r) => r.changed_by).filter((v): v is string => Boolean(v))),
  )
  const actorMap: Record<string, string> = {}
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', actorIds)
    for (const profile of profiles ?? []) {
      actorMap[profile.id] = profile.full_name ?? profile.email ?? '—'
    }
  }

  const initialEntries: AdminAuditEntry[] = page.map((row) => ({
    id: String(row.id),
    actorId: row.changed_by,
    action: row.action,
    resourceType: row.table_name,
    resourceId: row.resource_id_text ?? row.record_id ?? null,
    before: row.old_data ?? null,
    after: row.new_data ?? null,
    visibility: row.visibility,
    createdAt: row.changed_at,
  }))

  const weekCount = weekCountResult.count ?? 0
  const platformCount = platformCountResult.count ?? 0
  const uniqueActors = actorIds.length

  const stats: StatStripItem[] = [
    {
      key: 'this-week',
      label: 'Evenimente, 7 zile',
      value: weekCount,
      icon: 'Clock',
      hint: 'Tot ce s-a schimbat săptămâna asta',
    },
    {
      key: 'platform',
      label: 'Vizibilitate platformă',
      value: platformCount,
      icon: 'Shield',
      hint: 'Acțiuni administrative urmărite',
    },
    {
      key: 'in-page',
      label: 'În pagina curentă',
      value: page.length,
      icon: 'ClipboardText',
      hint: 'Sortate descrescător după dată',
    },
    {
      key: 'unique-actors',
      label: 'Autori unici',
      value: uniqueActors,
      icon: 'Users',
      hint: 'Pe primele rezultate vizibile',
    },
  ]

  return (
    <div data-testid="admin-audit-page" className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administrare"
        title="Jurnal de audit"
        description="Urmărește modificările administrative și de date sensibile. Filtrează după interval, acțiune sau resursă, sau exportă CSV pentru analiză externă."
      />

      <section aria-labelledby="audit-summary-title" className="space-y-3">
        <div className="px-1">
          <h2 id="audit-summary-title" className="text-[13px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
            Rezumat jurnal
          </h2>
        </div>
        <StatStrip items={stats} />
      </section>

      <section aria-labelledby="audit-events-title" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <div className="mb-4 border-b border-outline-variant pb-3">
          <h2 id="audit-events-title" className="text-[13px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
            Evenimente
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Exportul CSV aplică filtrele de server; căutarea filtrează doar tabelul încărcat.
          </p>
        </div>
        <AdminAuditTable
          initialEntries={initialEntries}
          initialNextCursor={nextCursor}
          actorMap={actorMap}
        />
      </section>
    </div>
  )
}
