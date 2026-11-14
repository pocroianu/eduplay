import { render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { NotificationBell } from './notification-bell';
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../actions/mark-notification-read';
import type { NotificationWithStudent } from '../types';

vi.mock('../actions/mark-notification-read', () => ({
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
}));

const unreadNotification: NotificationWithStudent = {
  id: 'notification-1',
  parent_id: 'parent-1',
  student_id: 'student-1',
  type: 'assignment_due',
  title: 'Temă nouă',
  message: 'Ai primit o temă nouă.',
  data: {},
  read_at: null,
  created_at: '2026-05-14T01:00:00.000Z',
  student: {
    id: 'student-1',
    username: 'ana',
  },
};

const secondUnreadNotification: NotificationWithStudent = {
  ...unreadNotification,
  id: 'notification-2',
  student_id: 'student-2',
  title: 'Altă temă',
  message: 'Ai primit încă o temă.',
  student: {
    id: 'student-2',
    username: 'bogdan',
  },
};

function createDeferredResult() {
  let resolve: (value: { success: boolean }) => void = () => {};
  const promise = new Promise<{ success: boolean }>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe('NotificationBell', () => {
  function renderBell(props: {
    unreadCount: number;
    recentNotifications: NotificationWithStudent[];
  }) {
    return render(
      <MantineProvider env="test">
        <NotificationBell {...props} />
      </MantineProvider>,
    );
  }

  async function openBell(props: {
    unreadCount: number;
    recentNotifications: NotificationWithStudent[];
  }) {
    const user = userEvent.setup();
    renderBell(props);
    const bell = screen.getByRole('button', {
      name: new RegExp(`notificări \\(${props.unreadCount} necitite\\)`, 'i'),
    });
    await user.click(bell);

    return { bell, user };
  }

  it('optimistically updates the unread badge while marking a dropdown notification read', async () => {
    const markRead = createDeferredResult();
    vi.mocked(markNotificationAsRead).mockReturnValue(markRead.promise);
    const { bell, user } = await openBell({
      unreadCount: 1,
      recentNotifications: [unreadNotification],
    });
    await user.click(await screen.findByRole('button', { name: /temă nouă/i }));

    expect(bell).toHaveAccessibleName('Notificări');

    markRead.resolve({ success: true });
  });

  it('rolls back the unread badge when marking a dropdown notification read fails', async () => {
    const markRead = createDeferredResult();
    vi.mocked(markNotificationAsRead).mockReturnValue(markRead.promise);
    const { bell, user } = await openBell({
      unreadCount: 1,
      recentNotifications: [unreadNotification],
    });
    await user.click(await screen.findByRole('button', { name: /temă nouă/i }));

    expect(bell).toHaveAccessibleName('Notificări');

    markRead.resolve({ success: false });

    await waitFor(() => {
      expect(bell).toHaveAccessibleName('Notificări (1 necitite)');
    });
  });

  it('rolls back the unread badge when marking all dropdown notifications read fails', async () => {
    const markAllRead = createDeferredResult();
    vi.mocked(markAllNotificationsAsRead).mockReturnValue(markAllRead.promise);
    const { bell, user } = await openBell({
      unreadCount: 2,
      recentNotifications: [unreadNotification, secondUnreadNotification],
    });
    await user.click(
      await screen.findByRole('button', { name: /marchează toate ca citite/i }),
    );

    expect(bell).toHaveAccessibleName('Notificări');

    markAllRead.resolve({ success: false });

    await waitFor(() => {
      expect(bell).toHaveAccessibleName('Notificări (2 necitite)');
    });
  });

  it('updates the unread badge after marking a dropdown notification read', async () => {
    vi.mocked(markNotificationAsRead).mockResolvedValue({ success: true });
    const { bell, user } = await openBell({
      unreadCount: 1,
      recentNotifications: [unreadNotification],
    });
    await user.click(await screen.findByRole('button', { name: /temă nouă/i }));

    await waitFor(() => {
      expect(markNotificationAsRead).toHaveBeenCalledWith('notification-1');
      expect(bell).toHaveAccessibleName('Notificări');
    });
  });
});
