'use client';

import { ActionMenu, type ActionMenuItem } from '@/shared/components/ui/kit/ActionMenu';

export type RowActionMenuItem = ActionMenuItem;

export interface RowActionMenuProps {
  /** Visible label for the trigger. */
  triggerLabel?: string;
  /** Menu items. */
  items: RowActionMenuItem[];
  className?: string;
}

/**
 * Companion action menu for admin `DataTable` rows.
 */
export function RowActionMenu({
  triggerLabel = 'Acțiuni',
  items,
  className,
}: RowActionMenuProps) {
  return (
    <ActionMenu
      triggerLabel={triggerLabel}
      items={items}
      className={className}
      triggerSize={44}
      menuWidth={180}
    />
  );
}
