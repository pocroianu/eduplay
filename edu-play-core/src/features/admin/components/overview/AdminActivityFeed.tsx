import Link from 'next/link'
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { Card, EmptyState } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'
import { formatRelativeTime } from '@/lib/i18n/formatters'
import { ADMIN_OVERVIEW_PANELS } from '@/features/admin/copy/overview'
import type { RecentAuditEntry } from '@/features/admin/queries'

export interface AdminActivityFeedProps {
  entries: RecentAuditEntry[]
}

/**
 * Last-10 audit feed for the admin overview. Renders nothing fancy — a
 * tone chip per row, the resource type, and the relative timestamp. The
 * "Vezi tot" link routes through to the full audit log surface so the
 * overview keeps to a glanceable summary.
 */
export function AdminActivityFeed({ entries }: AdminActivityFeedProps) {
  const copy = ADMIN_OVERVIEW_PANELS.activityFeed

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="font-headline text-lg font-bold text-on-surface">
          {copy.title}
        </h2>
        <Link
          href={ROUTES.ADMIN.AUDIT}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary rounded-full"
        >
          {copy.seeAll}
          <Icon name="CaretRight" size={18} />
        </Link>
      </header>

      {entries.length === 0 ? (
        <EmptyState icon="ClipboardText" title={copy.emptyState} />
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 rounded-2xl bg-surface-container/60 px-4 py-3"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <Icon name={iconForResource(entry.resourceType)} size={20} />
              </span>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">
                  {labelForEntry(entry)}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {formatRelativeTime(entry.occurredAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function iconForResource(resourceType: string): IconName {
  switch (resourceType) {
    case 'feature_flags':
      return 'ToggleRight'
    case 'profiles':
      return 'Users'
    case 'games':
      return 'GameController'
    case 'deletion_requests':
      return 'Gavel'
    case 'classes':
      return 'GraduationCap'
    default:
      return 'ListChecks'
  }
}

function labelForEntry(entry: RecentAuditEntry): string {
  if (entry.action) {
    return `${humanResource(entry.resourceType)} · ${humanAction(entry.action)}`
  }
  return humanResource(entry.resourceType)
}

function humanResource(resource: string): string {
  switch (resource) {
    case 'feature_flags':
      return 'Funcționalitate'
    case 'profiles':
      return 'Utilizator'
    case 'games':
      return 'Joc'
    case 'deletion_requests':
      return 'Cerere ștergere'
    case 'classes':
      return 'Clasă'
    default:
      return 'Înregistrare'
  }
}

function humanAction(action: string): string {
  return action.replace(/_/g, ' ')
}
