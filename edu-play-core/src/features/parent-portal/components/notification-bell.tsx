'use client';

import { useState } from 'react';
import { ActionIcon, Indicator, Popover } from '@mantine/core';
import { Icon } from '@/shared/components/ui/Icon';
import { NotificationDropdown } from './notification-dropdown';
import type { NotificationWithStudent } from '../types';

interface NotificationBellProps {
  unreadCount: number;
  recentNotifications: NotificationWithStudent[];
}

export function NotificationBell({
  unreadCount,
  recentNotifications,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [readAtById, setReadAtById] = useState<Record<string, string>>({});
  const [allReadAt, setAllReadAt] = useState<string | null>(null);

  const optimisticNotifications = recentNotifications.map((notification) =>
    allReadAt || readAtById[notification.id]
      ? {
          ...notification,
          read_at: notification.read_at ?? allReadAt ?? readAtById[notification.id],
        }
      : notification,
  );
  const optimisticallyReadCount = allReadAt
    ? unreadCount
    : recentNotifications.filter(
        (notification) => !notification.read_at && readAtById[notification.id],
      ).length;
  const optimisticUnreadCount = Math.max(0, unreadCount - optimisticallyReadCount);

  function handleNotificationRead(id: string) {
    setReadAtById((current) => ({ ...current, [id]: new Date().toISOString() }));
  }

  function handleNotificationReadRollback(id: string) {
    setReadAtById((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function handleAllNotificationsRead() {
    setAllReadAt(new Date().toISOString());
  }

  function handleAllNotificationsReadRollback() {
    setAllReadAt(null);
  }

  return (
    <Popover
      opened={isOpen}
      onChange={setIsOpen}
      position="bottom-end"
      offset={8}
      shadow="md"
      radius="lg"
      withinPortal={false}
      transitionProps={{ transition: 'pop-top-right', duration: 120 }}
    >
      <Indicator
        disabled={optimisticUnreadCount === 0}
        label={optimisticUnreadCount > 99 ? '99+' : optimisticUnreadCount}
        size={20}
        color="red"
        offset={5}
        styles={{
          indicator: {
            background: 'var(--color-error)',
            color: 'var(--color-on-error)',
            fontSize: '0.625rem',
            fontWeight: 800,
          },
        }}
      >
        <Popover.Target>
          <ActionIcon
            aria-label={`Notificări${optimisticUnreadCount > 0 ? ` (${optimisticUnreadCount} necitite)` : ''}`}
            onClick={() => setIsOpen((current) => !current)}
            radius="xl"
            size={44}
            variant="subtle"
            styles={{
              root: {
                color: 'var(--color-on-surface-variant)',
              },
            }}
          >
            <Icon name={optimisticUnreadCount > 0 ? 'BellRinging' : 'Bell'} aria-hidden />
          </ActionIcon>
        </Popover.Target>
      </Indicator>

      <Popover.Dropdown
        p={0}
        styles={{
          dropdown: {
            background: 'var(--color-surface-container-lowest)',
            borderColor: 'var(--color-outline-variant)',
            boxShadow: 'var(--shadow-popover)',
            overflow: 'hidden',
          },
        }}
      >
        <NotificationDropdown
          notifications={optimisticNotifications}
          onClose={() => setIsOpen(false)}
          onNotificationRead={handleNotificationRead}
          onNotificationReadRollback={handleNotificationReadRollback}
          onAllNotificationsRead={handleAllNotificationsRead}
          onAllNotificationsReadRollback={handleAllNotificationsReadRollback}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
