'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { isNavHrefActive } from './nav-utils'

interface BottomNavItem {
  icon: IconName
  label: string
  href: string
}

interface BottomNavBarProps {
  items: BottomNavItem[]
  /** Visual register: `kid` for student surfaces, `standard` for teacher/parent/admin. */
  mode?: 'kid' | 'standard'
}

const focusClass =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

export function BottomNavBar({ items, mode = 'kid' }: BottomNavBarProps) {
  const pathname = usePathname()

  if (mode === 'standard') {
    return (
      <nav aria-label="Navigare rapidă" className="fixed inset-x-0 bottom-0 z-50 px-3 pb-2 pt-1 md:hidden">
        <div
          className="mx-auto grid w-full max-w-xl min-w-0 gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-1 py-1 shadow-soft-sm"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const isActive = isNavHrefActive(pathname, item.href)
            return (
              <div key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-12 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[0.68rem] font-semibold leading-tight transition-colors ${focusClass} ${
                    isActive
                      ? 'bg-primary-soft text-primary-deep'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <Icon name={item.icon} weight={isActive ? 'fill' : 'regular'} size={20} />
                  <span className="min-w-0 max-w-full truncate">{item.label}</span>
                </Link>
              </div>
            )
          })}
        </div>
      </nav>
    )
  }

  return (
    <nav
      aria-label="Navigare rapidă"
      className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-outline-variant bg-surface-container-lowest px-4 pb-5 pt-2 font-label font-semibold shadow-soft-sm md:hidden"
    >
      {items.map((item) => {
        const isActive = isNavHrefActive(pathname, item.href)
        return (
          <div key={item.href}>
            <Link
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              style={{ minHeight: 64, minWidth: 64 }}
              className={`flex min-h-16 min-w-16 flex-col items-center justify-center rounded-xl px-4 py-2 text-on-surface-variant transition-colors ${focusClass} ${
                isActive
                  ? 'bg-primary-soft text-primary-deep'
                  : 'hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <Icon name={item.icon} size={24} weight={isActive ? 'fill' : 'regular'} />
            </Link>
          </div>
        )
      })}
    </nav>
  )
}
