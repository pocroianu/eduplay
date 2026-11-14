import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationList } from './notification-list';
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

function renderList() {
  return render(
    <MantineProvider>
      <NotificationList notifications={[unreadNotification]} total={1} />
    </MantineProvider>,
  );
}

beforeEach(() => {
  vi.mocked(markNotificationAsRead).mockReset();
  vi.mocked(markAllNotificationsAsRead).mockReset();
  vi.mocked(markNotificationAsRead).mockResolvedValue({ success: true });
  vi.mocked(markAllNotificationsAsRead).mockResolvedValue({ success: true });
});

describe('NotificationList', () => {
  it('uses Mantine actions for notification read controls', async () => {
    const user = userEvent.setup();
    renderList();

    const markAllButton = screen.getByRole('button', {
      name: /marchează toate ca citite/i,
    });
    expect(markAllButton).toHaveClass('mantine-Button-root');

    await user.click(markAllButton);

    await waitFor(() => {
      expect(markAllNotificationsAsRead).toHaveBeenCalled();
    });

    const markReadButton = screen.getByRole('button', {
      name: /marchează ca citită/i,
    });
    expect(markReadButton).toHaveClass('mantine-ActionIcon-root');

    await user.click(markReadButton);

    await waitFor(() => {
      expect(markNotificationAsRead).toHaveBeenCalledWith('notification-1');
    });
  });

  it('keeps notification actions on Mantine primitives instead of native buttons', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/features/parent-portal/components/notification-list.tsx',
      ),
      'utf8',
    );

    expect(source).not.toMatch(/<button\b/);
    expect(source).toContain('<Button');
    expect(source).toContain('<ActionIcon');
  });
});
