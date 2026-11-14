import Link from 'next/link'
import { Icon } from '@/shared/components/ui/Icon';
import { Card } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'
import { ADMIN_OVERVIEW_PANELS } from '@/features/admin/copy/overview'

const SHORTCUT_ROUTES = [
  { href: ROUTES.ADMIN.USERS, icon: 'Users' },
  { href: ROUTES.ADMIN.FLAGS, icon: 'ToggleRight' },
  { href: ROUTES.ADMIN.PRIVACY, icon: 'Gavel' },
] as const

/**
 * Three quick navigation shortcuts under the activity feed. Routes to the
 * users, feature-flags, and privacy admin surfaces. Copy comes from the
 * shared `ADMIN_OVERVIEW_PANELS.quickShortcuts.items` tuple — the order
 * matches `SHORTCUT_ROUTES` so we don't drift between copy and href.
 */
export function AdminQuickShortcuts() {
  const copy = ADMIN_OVERVIEW_PANELS.quickShortcuts

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <h2 className="font-headline text-lg font-bold text-on-surface">
        {copy.title}
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="list">
        {copy.items.map((item, index) => {
          const route = SHORTCUT_ROUTES[index]
          if (!route) return null
          return (
            <li key={route.href}>
              <Link
                href={route.href}
                className="flex h-full flex-col gap-2 rounded-2xl bg-surface-container/60 p-4 transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"
                  aria-hidden="true"
                >
                  <Icon name={route.icon} size={20} />
                </span>
                <span className="text-sm font-bold text-on-surface">{item.label}</span>
                <span className="text-xs text-on-surface-variant">{item.helper}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
