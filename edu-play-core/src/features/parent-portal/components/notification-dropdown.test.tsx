import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import { NotificationDropdown } from './notification-dropdown';
import type { NotificationWithStudent } from '../types';

vi.mock('../actions/mark-notification-read', () => ({
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
}));

const notification: NotificationWithStudent = {
  id: 'notification-1',
  parent_id: 'parent-1',
  student_id: 'student-1',
  type: 'assignment_due',
  title: 'O notificare cu titlu lung pentru ecrane înguste',
  message: 'Un mesaj suficient de lung pentru a verifica împachetarea textului pe mobil.',
  data: {},
  read_at: null,
  created_at: '2026-05-14T01:00:00.000Z',
  student: {
    id: 'student-1',
    username: 'ana',
  },
};

describe('NotificationDropdown', () => {
  function renderDropdown() {
    return render(
      <MantineProvider>
        <NotificationDropdown notifications={[notification]} onClose={vi.fn()} />
      </MantineProvider>,
    );
  }

  it('constrains the dropdown width to the viewport with tokenized CSS', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/features/parent-portal/components/notification-dropdown.module.css'),
      'utf8',
    );

    expect(css).toContain('width: min(380px, calc(100vw - 2rem));');
  });

  it('wraps notification text and exposes accessible Mantine actions', () => {
    renderDropdown();

    expect(screen.getByRole('button', { name: /marchează toate ca citite/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /o notificare cu titlu lung/i })).toBeEnabled();
    expect(screen.getByRole('link', { name: /vezi toate notificările/i })).toHaveAttribute(
      'href',
      '/parent/notifications',
    );
    expect(screen.getByText(notification.title)).toBeInTheDocument();
    expect(screen.getByText(notification.message)).toBeInTheDocument();
  });

  it('keeps dropdown controls on Mantine primitives instead of raw buttons', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/parent-portal/components/notification-dropdown.tsx'),
      'utf8',
    );

    expect(source).toContain('ScrollArea');
    expect(source).toContain('UnstyledButton');
    expect(source).toContain('Button');
    expect(source).not.toMatch(/<button\b/);
  });
});
