'use client';

import { useContext, type ReactNode } from 'react';
import {
  ActionIcon,
  Box,
  MantineContext,
  MantineProvider,
  Menu,
  type ActionIconProps,
  type MenuProps,
} from '@mantine/core';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { cn } from '@/shared/lib/utils/cn';
import classes from './ActionMenu.module.css';

export interface ActionMenuItem {
  key: string;
  label: ReactNode;
  icon?: IconName;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  triggerLabel?: string;
  className?: string;
  triggerSize?: ActionIconProps['size'];
  menuWidth?: MenuProps['width'];
  position?: MenuProps['position'];
}

const DEFAULT_TRIGGER_LABEL = 'Acțiuni';

function ActionMenuContent({
  items,
  triggerLabel = DEFAULT_TRIGGER_LABEL,
  className,
  triggerSize = 44,
  menuWidth = 180,
  position = 'bottom-end',
}: ActionMenuProps) {
  return (
    <Box className={cn(classes.root, className)}>
      <Menu
        position={position}
        width={menuWidth}
        offset={6}
        shadow="none"
        radius="md"
        withinPortal={false}
        hideDetached={false}
      >
        <Menu.Target>
          <ActionIcon
            type="button"
            aria-label={triggerLabel}
            radius="xl"
            size={triggerSize}
            variant="subtle"
            className={classes.trigger}
          >
            <Icon name="DotsThreeVertical" size="md" weight="bold" aria-hidden />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown aria-label={triggerLabel} className={classes.dropdown}>
          {items.map((item) => (
            <Menu.Item
              key={item.key}
              disabled={item.disabled}
              aria-disabled={item.disabled || undefined}
              data-destructive={item.destructive || undefined}
              className={classes.item}
              leftSection={
                item.icon ? <Icon name={item.icon} size="sm" aria-hidden /> : undefined
              }
              onClick={item.onSelect}
            >
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Box>
  );
}

export function ActionMenu(props: ActionMenuProps) {
  const mantineContext = useContext(MantineContext);
  const menu = <ActionMenuContent {...props} />;

  return mantineContext ? menu : <MantineProvider>{menu}</MantineProvider>;
}
