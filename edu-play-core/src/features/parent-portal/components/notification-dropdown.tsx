'use client';

import { useTransition } from 'react';
import {
  Box,
  Button,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import Link from 'next/link';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { ROUTES } from '@/shared/lib/constants';
import { markNotificationAsRead, markAllNotificationsAsRead } from '../actions/mark-notification-read';
import type { NotificationWithStudent, NotificationType } from '../types';
import classes from './notification-dropdown.module.css';

const NOTIFICATION_ICONS: Record<NotificationType, IconName> = {
  assignment_due: 'Warning',
  assignment_completed: 'CheckCircle',
  game_completed: 'GameController',
  milestone: 'Flag',
  achievement: 'Trophy',
  weekly_summary: 'ClipboardText',
  artifact_published: 'Palette',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return 'Chiar acum';
  if (minutes < 60) return `Acum ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Acum ${hours}h`;

  const days = Math.floor(hours / 24);
  return `Acum ${days}z`;
}

interface NotificationDropdownProps {
  notifications: NotificationWithStudent[];
  onClose: () => void;
  onNotificationRead?: (id: string) => void;
  onNotificationReadRollback?: (id: string) => void;
  onAllNotificationsRead?: () => void;
  onAllNotificationsReadRollback?: () => void;
}

export function NotificationDropdown({
  notifications,
  onClose,
  onNotificationRead,
  onNotificationReadRollback,
  onAllNotificationsRead,
  onAllNotificationsReadRollback,
}: NotificationDropdownProps) {
  const [isPending, startTransition] = useTransition();

  function handleMarkRead(id: string) {
    onNotificationRead?.(id);
    startTransition(async () => {
      const result = await markNotificationAsRead(id);
      if (!result.success) {
        onNotificationReadRollback?.(id);
      }
    });
  }

  function handleMarkAllRead() {
    onAllNotificationsRead?.();
    startTransition(async () => {
      const result = await markAllNotificationsAsRead();
      if (!result.success) {
        onAllNotificationsReadRollback?.();
      }
    });
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <Box className={classes.root}>
      <Group className={classes.header} justify="space-between" gap="md" wrap="nowrap">
        <Text component="h3" className={classes.title}>
          Notificări recente
        </Text>
        {unreadCount > 0 ? (
          <Button
            onClick={handleMarkAllRead}
            disabled={isPending}
            size="xs"
            radius="md"
            variant="subtle"
            styles={{
              root: {
                color: 'var(--color-primary)',
                fontWeight: 700,
              },
            }}
          >
            Marchează toate ca citite
          </Button>
        ) : null}
      </Group>

      <Divider color="var(--color-outline-variant)" />

      <ScrollArea.Autosize mah={360} type="auto">
        {notifications.length === 0 ? (
          <Stack align="center" gap="sm" className={classes.empty}>
            <ThemeIcon
              size={44}
              radius="xl"
              variant="light"
              color="gray"
              styles={{
                root: {
                  background: 'var(--color-surface-container)',
                  color: 'var(--color-on-surface-variant)',
                },
              }}
            >
              <Icon name="BellSlash" size={22} aria-hidden />
            </ThemeIcon>
            <Text className={classes.emptyText}>Nicio notificare nouă</Text>
          </Stack>
        ) : (
          <Stack gap={4} className={classes.list}>
            {notifications.map((notification) => {
              const isUnread = !notification.read_at;
              const icon =
                NOTIFICATION_ICONS[notification.type as NotificationType] ??
                'Bell';

              return (
                <UnstyledButton
                  key={notification.id}
                  className={classes.item}
                  data-unread={isUnread || undefined}
                  onClick={() => {
                    if (isUnread) handleMarkRead(notification.id);
                    onClose();
                  }}
                >
                  <ThemeIcon
                    size={38}
                    radius="xl"
                    className={classes.itemIcon}
                    data-unread={isUnread || undefined}
                  >
                    <Icon name={icon} size={18} aria-hidden />
                  </ThemeIcon>
                  <Box className={classes.itemBody}>
                    <Group align="flex-start" gap="xs" wrap="nowrap">
                      <Text className={classes.itemTitle} data-unread={isUnread || undefined}>
                        {notification.title}
                      </Text>
                      {isUnread ? <span className={classes.unreadDot} aria-hidden /> : null}
                    </Group>
                    <Text className={classes.message}>{notification.message}</Text>
                    <Text className={classes.meta}>
                      {notification.student?.username ? (
                        <Text component="span" className={classes.studentName}>
                          {notification.student.username} ·{' '}
                        </Text>
                      ) : null}
                      {notification.created_at ? timeAgo(notification.created_at) : ''}
                    </Text>
                  </Box>
                </UnstyledButton>
              );
            })}
          </Stack>
        )}
      </ScrollArea.Autosize>

      <Divider color="var(--color-outline-variant)" />

      <Box className={classes.footer}>
        <Button
          component={Link}
          href={ROUTES.PARENT.NOTIFICATIONS}
          onClick={onClose}
          fullWidth
          radius="md"
          variant="subtle"
          rightSection={<Icon name="ArrowRight" size={16} aria-hidden />}
          styles={{
            root: {
              color: 'var(--color-primary)',
              fontWeight: 700,
              minHeight: 44,
            },
          }}
        >
          Vezi toate notificările
        </Button>
      </Box>
    </Box>
  );
}
