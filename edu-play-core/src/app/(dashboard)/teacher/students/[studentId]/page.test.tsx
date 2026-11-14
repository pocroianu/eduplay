import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ROUTES } from '@/shared/lib/constants';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentPropsWithoutRef<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
  notFound: () => notFoundMock(),
}));

vi.mock('@/features/teacher-dashboard', () => ({
  StudentDetailContent: () => <div data-testid="student-detail-content" />,
}));

const authGetUserMock = vi.fn();
const profilesSingleMock = vi.fn();
const studentsSingleMock = vi.fn();
const classesSingleMock = vi.fn();
const activityProgressOrderMock = vi.fn();

const profilesBuilder = {
  select: vi.fn(() => profilesBuilder),
  eq: vi.fn(() => profilesBuilder),
  single: () => profilesSingleMock(),
};

const studentsBuilder = {
  select: vi.fn(() => studentsBuilder),
  eq: vi.fn(() => studentsBuilder),
  single: () => studentsSingleMock(),
};

const classesBuilder = {
  select: vi.fn(() => classesBuilder),
  eq: vi.fn(() => classesBuilder),
  single: () => classesSingleMock(),
};

const activityProgressBuilder = {
  select: vi.fn(() => activityProgressBuilder),
  eq: vi.fn(() => activityProgressBuilder),
  order: () => activityProgressOrderMock(),
};

const supabase = {
  auth: {
    getUser: () => authGetUserMock(),
  },
  from: vi.fn((table: string) => {
    if (table === 'profiles') return profilesBuilder;
    if (table === 'students') return studentsBuilder;
    if (table === 'classes') return classesBuilder;
    if (table === 'activity_progress') return activityProgressBuilder;
    throw new Error(`unexpected table=${table}`);
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(supabase),
}));

import StudentDetailPage from './page';

beforeEach(() => {
  redirectMock.mockClear();
  notFoundMock.mockClear();
  authGetUserMock.mockReset();
  profilesSingleMock.mockReset();
  studentsSingleMock.mockReset();
  classesSingleMock.mockReset();
  activityProgressOrderMock.mockReset();

  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'teacher-1' } },
  });

  profilesSingleMock
    .mockResolvedValueOnce({
      data: {
        id: 'teacher-1',
        full_name: 'Prof. Maria Ionescu',
        email: 'maria@example.com',
        role: 'teacher',
        avatar_url: null,
      },
    })
    .mockResolvedValueOnce({
      data: {
        full_name: 'Andrei Popescu',
        email: 'andrei@example.com',
        avatar_url: null,
        date_of_birth: '2017-05-01',
      },
    });

  studentsSingleMock.mockResolvedValue({
    data: {
      id: 'student-1',
      username: 'andrei.popescu',
      class_id: 'class-1',
    },
  });

  classesSingleMock
    .mockResolvedValueOnce({
      data: { id: 'class-1', name: 'Clasa Buburuzelor' },
    })
    .mockResolvedValueOnce({
      data: { id: 'class-1' },
    });

  activityProgressOrderMock.mockResolvedValue({ data: [] });
});

describe('/teacher/students/[studentId] page', () => {
  it('renders the portfolio CTA as a link instead of a nested button', async () => {
    const ui = await StudentDetailPage({
      params: Promise.resolve({ studentId: 'student-1' }),
    });

    render(ui);

    const link = screen.getByRole('link', { name: /vezi portofoliul/i });
    expect(link).toHaveAttribute(
      'href',
      ROUTES.TEACHER.STUDENT_PORTFOLIO('student-1'),
    );
    expect(screen.queryByRole('button', { name: /vezi portofoliul/i })).toBeNull();
  });
});
