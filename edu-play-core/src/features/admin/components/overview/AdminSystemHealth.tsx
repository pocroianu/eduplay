import { Icon } from '@/shared/components/ui/Icon';
import { Badge, Card } from '@/shared/components/ui/kit'
import { ADMIN_OVERVIEW_PANELS } from '@/features/admin/copy/overview'

/**
 * Sidebar health card. The values shown are placeholders — wiring real
 * platform telemetry (queue depth, storage utilisation, API uptime) is a
 * follow-up ticket. The static "Operațional" state intentionally signals
 * "we have not detected an outage" rather than "everything is verified
 * green"; flip the props once a probe lands.
 */
export interface AdminSystemHealthProps {
  apiStatus?: 'healthy' | 'degraded' | 'down'
  queueLabel?: string
  storagePercent?: number
}

export function AdminSystemHealth({
  apiStatus = 'healthy',
  queueLabel = '0 sarcini în coadă',
  storagePercent = 32,
}: AdminSystemHealthProps) {
  const copy = ADMIN_OVERVIEW_PANELS.systemHealth
  const tone =
    apiStatus === 'healthy' ? 'success' : apiStatus === 'degraded' ? 'warning' : 'danger'
  const badgeLabel =
    apiStatus === 'healthy'
      ? copy.healthyBadge
      : apiStatus === 'degraded'
        ? copy.degradedBadge
        : copy.downBadge

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="font-headline text-lg font-bold text-on-surface">
          {copy.title}
        </h2>
        <Badge tone={tone}>{badgeLabel}</Badge>
      </header>

      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2 text-on-surface-variant">
            <Icon name="CheckCircle" size={18} />
            {copy.apiStatusLabel}
          </dt>
          <dd className="font-semibold text-on-surface">{badgeLabel}</dd>
        </div>

        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2 text-on-surface-variant">
            <Icon name="Clock" size={18} />
            {copy.queueLabel}
          </dt>
          <dd className="font-semibold text-on-surface">{queueLabel}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-on-surface-variant">
              <Icon name="HardDrives" size={18} />
              {copy.storageLabel}
            </dt>
            <dd className="font-semibold text-on-surface">{storagePercent}%</dd>
          </div>
          <div
            role="progressbar"
            aria-valuenow={storagePercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={copy.storageLabel}
            className="h-2 rounded-full bg-surface-container overflow-hidden"
          >
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${Math.max(0, Math.min(100, storagePercent))}%` }}
            />
          </div>
        </div>
      </dl>
    </Card>
  )
}
