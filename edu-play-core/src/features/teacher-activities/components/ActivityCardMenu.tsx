'use client'

import { ActionMenu, type ActionMenuItem } from '@/shared/components/ui/kit/ActionMenu'

export type ActivityCardMenuItem = ActionMenuItem

interface ActivityCardMenuProps {
  items: ActivityCardMenuItem[]
  triggerLabel?: string
  className?: string
}

export function ActivityCardMenu({
  items,
  triggerLabel = 'Mai multe acțiuni',
  className,
}: ActivityCardMenuProps) {
  return (
    <ActionMenu
      triggerLabel={triggerLabel}
      items={items}
      className={className}
      triggerSize={44}
      menuWidth={190}
    />
  )
}
