import { Icon } from '@/shared/components/ui/Icon';
import { Card } from '@/shared/components/ui/kit'
import { formatRelativeTime } from '@/lib/i18n/formatters'
import { ADMIN_OVERVIEW_PANELS } from '@/features/admin/copy/overview'
import type { RecentFlagChange } from '@/features/admin/queries'

export interface AdminRecentReleasesProps {
  changes: RecentFlagChange[]
}

/**
 * Sidebar feed listing the last few feature-flag changes. Driven by the
 * `getRecentFlagChanges` query so it always reflects the canonical event
 * timeline — no separate cache. Empty-state copy lives in the shared copy
 * module to keep diacritics review centralised.
 */
export function AdminRecentReleases({ changes }: AdminRecentReleasesProps) {
  const copy = ADMIN_OVERVIEW_PANELS.recentReleases

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <h2 className="font-headline text-lg font-bold text-on-surface">
        {copy.title}
      </h2>

      {changes.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{copy.emptyState}</p>
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {changes.map((change, index) => (
            <li
              key={`${change.flagName}-${change.occurredAt}-${index}`}
              className="flex items-start gap-3"
            >
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <Icon name="ToggleRight" size={16} />
              </span>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">
                  <span className="font-headline">{change.flagName}</span>
                  <span className="text-on-surface-variant"> · </span>
                  <span>{copy.actionLabels[change.action]}</span>
                </p>
                <p className="text-xs text-on-surface-variant">
                  {formatRelativeTime(change.occurredAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
