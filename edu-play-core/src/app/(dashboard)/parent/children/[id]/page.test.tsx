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

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock('@/features/parent-portal', () => ({
  ChildDetailContent: () => <div data-testid="child-detail-content" />,
}));

const getChildProgressSummaryMock = vi.fn();
const getRecentActivityMock = vi.fn();
const getChildConsentsMock = vi.fn();
vi.mock('@/features/parent-portal/server', () => ({
  getChildProgressSummary: (...args: unknown[]) =>
    getChildProgressSummaryMock(...args),
  getRecentActivity: (...args: unknown[]) => getRecentActivityMock(...args),
  getChildConsents: (...args: unknown[]) => getChildConsentsMock(...args),
}));

const getChildrenGamesProgressMock = vi.fn();
vi.mock('@/features/games/server', () => ({
  getChildrenGamesProgress: (...args: unknown[]) =>
    getChildrenGamesProgressMock(...args),
}));

const authGetUserMock = vi.fn();
const profilesSingleMock = vi.fn();
const parentChildrenSingleMock = vi.fn();
const studentsSingleMock = vi.fn();

const profilesBuilder = {
  select: vi.fn(() => profilesBuilder),
  eq: vi.fn(() => profilesBuilder),
  single: () => profilesSingleMock(),
};

const parentChildrenBuilder = {
  select: vi.fn(() => parentChildrenBuilder),
  eq: vi.fn(() => parentChildrenBuilder),
  single: () => parentChildrenSingleMock(),
};

const studentsBuilder = {
  select: vi.fn(() => studentsBuilder),
  eq: vi.fn(() => studentsBuilder),
  single: () => studentsSingleMock(),
};

const supabase = {
  auth: {
    getUser: () => authGetUserMock(),
  },
  from: vi.fn((table: string) => {
    if (table === 'profiles') return profilesBuilder;
    if (table === 'parent_children') return parentChildrenBuilder;
    if (table === 'students') return studentsBuilder;
    throw new Error(`unexpected table=${table}`);
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(supabase),
}));

import ChildDetailPage from './page';

beforeEach(() => {
  redirectMock.mockClear();
  authGetUserMock.mockReset();
  profilesSingleMock.mockReset();
  parentChildrenSingleMock.mockReset();
  studentsSingleMock.mockReset();
  getChildProgressSummaryMock.mockReset();
  getChildrenGamesProgressMock.mockReset();
  getRecentActivityMock.mockReset();
  getChildConsentsMock.mockReset();

  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'parent-1' } },
  });
  profilesSingleMock.mockResolvedValue({
    data: {
      id: 'parent-1',
      full_name: 'Părinte Test',
      email: 'parent@example.com',
      role: 'parent',
      avatar_url: null,
    },
  });
  parentChildrenSingleMock.mockResolvedValue({
    data: { id: 'link-1' },
  });
  studentsSingleMock.mockResolvedValue({
    data: {
      id: 'child-1',
      username: 'ana.pop',
      avatar_url: null,
      created_at: '2026-05-01T09:00:00.000Z',
    },
  });
  getChildProgressSummaryMock.mockResolvedValue({
    totalGamesPlayed: 0,
    completedGames: 0,
    inProgressGames: 0,
    averageScore: 0,
    totalPlayTime: 0,
    lastActivityAt: null,
  });
  getChildrenGamesProgressMock.mockResolvedValue([]);
  getRecentActivityMock.mockResolvedValue([]);
  getChildConsentsMock.mockResolvedValue({});
});

describe('/parent/children/[id] page', () => {
  it('wraps child detail and CTA in a single main landmark', async () => {
    const ui = await ChildDetailPage({
      params: Promise.resolve({ id: 'child-1' }),
    });

    render(ui);

    const main = screen.getByRole('main', { name: /detalii copil/i });
    expect(main).toContainElement(screen.getByTestId('child-detail-content'));
    expect(main).toContainElement(screen.getByRole('link', { name: /vezi portofoliul/i }));
  });

  it('renders the portfolio CTA as a link instead of a nested button', async () => {
    const ui = await ChildDetailPage({
      params: Promise.resolve({ id: 'child-1' }),
    });

    render(ui);

    const link = screen.getByRole('link', { name: /vezi portofoliul/i });
    expect(link).toHaveAttribute(
      'href',
      ROUTES.PARENT.CHILD_PORTFOLIO('child-1'),
    );
    expect(screen.queryByRole('button', { name: /vezi portofoliul/i })).toBeNull();
  });
});
