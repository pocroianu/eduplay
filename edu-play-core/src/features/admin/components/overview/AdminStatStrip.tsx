import { StatCard } from '@/shared/components/ui/kit'
import { Badge } from '@/shared/components/ui/kit'
import { formatNumber } from '@/lib/i18n/formatters'
import { ADMIN_OVERVIEW_STATS } from '@/features/admin/copy/overview'
import type { AdminOverviewSnapshot } from '@/features/admin/queries'

export interface AdminStatStripProps {
  snapshot: Pick<
    AdminOverviewSnapshot,
    'activeUsers' | 'publishedGames' | 'gdprOpen' | 'auditIncidents'
  >
}

/**
 * Four-up overview stats for the admin home: active users (7d), published
 * games, open GDPR requests, and 24h audit incidents. Wraps `StatCard` from
 * the kit so re-skins (Duo polish, alt themes) flow through without per-page
 * edits. Responsive grid: 1-up mobile, 2x2 tablet, 4-up desktop.
 */
export function AdminStatStrip({ snapshot }: AdminStatStripProps) {
  const { activeUsers, publishedGames, gdprOpen, auditIncidents } = snapshot
  const gdprBadge = gdprOpen.count > 0
  const auditTone: 'warning' | 'primary' = auditIncidents.count > 0 ? 'warning' : 'primary'

  return (
    <section
      aria-label="Statistici platformă"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8"
    >
      <StatCard
        label={ADMIN_OVERVIEW_STATS.activeUsers.label}
        value={formatNumber(activeUsers.count)}
        icon="TrendUp"
        tone="primary"
      />

      <StatCard
        label={ADMIN_OVERVIEW_STATS.publishedGames.label}
        value={`${formatNumber(publishedGames.published)} / ${formatNumber(publishedGames.total)}`}
        icon="GameController"
        tone="tertiary"
      />

      <div className="relative">
        <StatCard
          label={ADMIN_OVERVIEW_STATS.gdprOpen.label}
          value={formatNumber(gdprOpen.count)}
          icon="Gavel"
          tone="secondary"
        />
        {gdprBadge && (
          <span className="absolute top-3 right-3">
            <Badge tone="warning">Atenție</Badge>
          </span>
        )}
      </div>

      <StatCard
        label={ADMIN_OVERVIEW_STATS.auditIncidents.label}
        value={formatNumber(auditIncidents.count)}
        icon="ListChecks"
        tone={auditTone}
      />
    </section>
  )
}
