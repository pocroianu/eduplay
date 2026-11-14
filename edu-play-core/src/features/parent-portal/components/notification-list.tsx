'use client';

import { useTransition } from 'react';
import { ActionIcon, Button } from '@mantine/core';
import { motion } from 'framer-motion';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../actions/mark-notification-read';
import type { NotificationWithStudent, NotificationType } from '../types';
import { formatRelativeTime } from '@/lib/i18n/formatters';

const NOTIFICATION_ICONS: Record<NotificationType, IconName> = {
  assignment_due: 'Warning',
  assignment_completed: 'CheckCircle',
  game_completed: 'GameController',
  milestone: 'Flag',
  achievement: 'Trophy',
  weekly_summary: 'ClipboardText',
  artifact_published: 'Palette',
};

const TYPE_COLORS: Record<NotificationType, { bg: string; text: string }> = {
  assignment_due: {
    bg: 'bg-error-container/40',
    text: 'text-error',
  },
  assignment_completed: {
    bg: 'bg-primary-soft',
    text: 'text-primary',
  },
  game_completed: {
    bg: 'bg-primary-container/40',
    text: 'text-primary',
  },
  milestone: {
    bg: 'bg-gold-container/40',
    text: 'text-gold',
  },
  achievement: {
    bg: 'bg-primary-soft',
    text: 'text-primary',
  },
  weekly_summary: {
    bg: 'bg-surface-container',
    text: 'text-on-surface-variant',
  },
  artifact_published: {
    bg: 'bg-primary-container/40',
    text: 'text-primary',
  },
};

interface NotificationListProps {
  notifications: NotificationWithStudent[];
  total: number;
}

export function NotificationList({
  notifications,
  total,
}: NotificationListProps) {
  const [isPending, startTransition] = useTransition();
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await markNotificationAsRead(id);
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsAsRead();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-on-surface">
            Notificări
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {total === 0
              ? 'Nicio notificare'
              : unreadCount > 0
                ? `${unreadCount} necitit${unreadCount === 1 ? 'ă' : 'e'} din ${total}`
                : `${total} notificăr${total === 1 ? 'e' : 'i'}`}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            onClick={handleMarkAllRead}
            loading={isPending}
            loaderProps={{ size: 16, color: 'currentColor' }}
            color="purple"
            h={44}
            leftSection={<Icon name="Checks" size={16} />}
            radius="xl"
            size="sm"
            variant="default"
            classNames={{
              root: 'bg-surface-container-lowest border-outline-variant shadow-soft-sm text-primary hover:bg-surface-container',
              label: 'font-bold',
            }}
          >
            Marchează toate ca citite
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-lowest border border-outline-variant shadow-soft-sm rounded-2xl"
        >
          <div className="flex flex-col items-center py-16 px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-5">
              <Icon
                name="BellSlash"
                size={40}
                className="text-on-surface-variant/40"
              />
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-2">
              Nu ai notificări încă
            </h3>
            <p className="text-sm text-on-surface-variant max-w-sm">
              Vei primi notificări aici când copilul tău va primi teme noi sau
              va atinge realizări importante.
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant shadow-soft-sm rounded-2xl overflow-hidden divide-y divide-outline-variant/10">
          {notifications.map((notification, index) => {
            const isUnread = !notification.read_at;
            const type = notification.type as NotificationType;
            const icon = NOTIFICATION_ICONS[type] ?? 'notifications';
            const colors = TYPE_COLORS[type] ?? TYPE_COLORS.weekly_summary;

            return (
              <motion.div
                key={notification.id}
                data-testid="parent-notification-row"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`flex gap-4 px-6 py-5 transition-colors ${
                  isUnread ? 'bg-primary/[0.03]' : ''
                }`}
              >
                <div
                  className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${colors.bg} ${colors.text}`}
                >
                  <Icon name={icon} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`text-[15px] leading-snug ${
                          isUnread
                            ? 'font-bold text-on-surface'
                            : 'font-medium text-on-surface-variant'
                        }`}
                      >
                        {notification.title}
                      </p>
                      <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {notification.student?.username && (
                          <span className="text-xs font-bold text-on-surface-variant bg-surface-container rounded-full px-2 py-0.5">
                            {notification.student.username}
                          </span>
                        )}
                        <span className="text-xs text-on-surface-variant/60">
                          {notification.created_at
                            ? formatRelativeTime(
                                new Date(notification.created_at),
                              )
                            : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isUnread && (
                        <>
                          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                          <ActionIcon
                            onClick={() => handleMarkRead(notification.id)}
                            disabled={isPending}
                            color="gray"
                            radius="xl"
                            size={44}
                            variant="subtle"
                            classNames={{
                              root: 'text-on-surface-variant hover:bg-surface-container',
                            }}
                            aria-label="Marchează ca citită"
                          >
                            <Icon name="Check" size={16} />
                          </ActionIcon>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
