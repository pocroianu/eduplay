import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Artifact } from '@/features/portfolio';

interface DraftArtifactsPage {
  items: Artifact[];
  nextCursor: string | null;
}

// next/navigation.redirect throws a marker error so callers short-circuit.
const redirectError = (path: string) => {
  const err = new Error(`NEXT_REDIRECT:${path}`);
  // tag for assertion
  (err as Error & { __redirect__: string }).__redirect__ = path;
  return err;
};

const redirectMock = vi.fn((path: string) => {
  throw redirectError(path);
});

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

const supabaseSingleMock = vi.fn();
const supabaseGetUserMock = vi.fn();

const profilesBuilder: Record<string, unknown> = {};
profilesBuilder.select = vi.fn(() => profilesBuilder);
profilesBuilder.eq = vi.fn(() => profilesBuilder);
profilesBuilder.single = () => supabaseSingleMock();

const classesBuilder: Record<string, unknown> = {};
classesBuilder.select = vi.fn(() => classesBuilder);
classesBuilder.eq = vi.fn(() => classesBuilder);
classesBuilder.order = vi.fn(() =>
  Promise.resolve({ data: [], error: null }),
);

const studentsBuilder: Record<string, unknown> = {};
studentsBuilder.select = vi.fn(() => studentsBuilder);
studentsBuilder.in = vi.fn(() => studentsBuilder);
studentsBuilder.order = vi.fn(() =>
  Promise.resolve({ data: [], error: null }),
);

const supabase = {
  auth: { getUser: () => supabaseGetUserMock() },
  from: vi.fn((table: string) => {
    if (table === 'profiles') return profilesBuilder;
    if (table === 'classes') return classesBuilder;
    if (table === 'students') return studentsBuilder;
    throw new Error(`unexpected table=${table}`);
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(supabase),
}));

const getDraftArtifactsForTeacherMock = vi.fn<
  (...args: unknown[]) => Promise<DraftArtifactsPage>
>();
const getSignedUrlsForArtifactsMock = vi.fn();
vi.mock('@/features/portfolio/server', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/portfolio/server')
  >('@/features/portfolio/server');
  return {
    ...actual,
    getDraftArtifactsForTeacher: (...args: unknown[]) =>
      getDraftArtifactsForTeacherMock(...args),
    getSignedUrlsForArtifacts: (...args: unknown[]) =>
      getSignedUrlsForArtifactsMock(...args),
  };
});

import TeacherPortfolioPage from './page';

const teacherUser = { id: 'teacher-1' };
const teacherProfile = { id: 'teacher-1', role: 'teacher' as const };

beforeEach(() => {
  redirectMock.mockClear();
  supabaseGetUserMock.mockReset();
  supabaseSingleMock.mockReset();
  (classesBuilder.order as ReturnType<typeof vi.fn>).mockImplementation(() =>
    Promise.resolve({ data: [], error: null }),
  );
  (studentsBuilder.order as ReturnType<typeof vi.fn>).mockImplementation(() =>
    Promise.resolve({ data: [], error: null }),
  );
  getDraftArtifactsForTeacherMock.mockReset();
  getSignedUrlsForArtifactsMock.mockReset();
  getSignedUrlsForArtifactsMock.mockResolvedValue({});
});

describe('/teacher/portfolio page', () => {
  it('redirects unauthenticated users to the login route', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: null } });

    await expect(
      TeacherPortfolioPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrowError(/NEXT_REDIRECT:\/login/);
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('redirects non-teacher users to the login route', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: teacherUser } });
    supabaseSingleMock.mockResolvedValue({
      data: { id: 'teacher-1', role: 'parent' },
    });

    await expect(
      TeacherPortfolioPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrowError(/NEXT_REDIRECT:\/login/);
  });

  it('renders the empty state when no drafts are queued', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: teacherUser } });
    supabaseSingleMock.mockResolvedValue({ data: teacherProfile });
    getDraftArtifactsForTeacherMock.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const ui = await TeacherPortfolioPage({
      searchParams: Promise.resolve({}),
    });
    render(ui);
    expect(
      screen.getByText('Nu ai răspunsuri de revizuit. Bună treabă!'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /adaugă dovadă/i }),
    ).toBeInTheDocument();
  });

  it('renders one card per draft artifact returned by the query', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: teacherUser } });
    supabaseSingleMock.mockResolvedValue({ data: teacherProfile });
    (classesBuilder.order as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        data: [{ id: 'cls-1', name: 'Clasa 1A' }],
        error: null,
      }),
    );
    (studentsBuilder.order as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        data: [{ id: 'stu-1', username: 'andrei.vulpe', class_id: 'cls-1' }],
        error: null,
      }),
    );
    getDraftArtifactsForTeacherMock.mockResolvedValue({
      items: [
        {
          id: 'art-1',
          studentId: 'stu-1',
          classId: 'cls-1',
          title: 'Castelul fermecat',
          artifactType: 'drawing',
          storagePath: 'students/stu-1/x.png',
          visibility: 'draft',
          reviewedBy: null,
          reviewedAt: null,
          metadata: {},
          createdAt: '2026-04-15T09:30:00.000Z',
          updatedAt: '2026-04-15T09:30:00.000Z',
        },
      ],
      nextCursor: null,
    });

    const ui = await TeacherPortfolioPage({
      searchParams: Promise.resolve({}),
    });
    render(ui);

    expect(
      screen.getByRole('heading', { name: 'Castelul fermecat' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('andrei.vulpe').length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText('Clasa 1A').length).toBeGreaterThanOrEqual(1);
  });

  it('forwards parsed search params into the draft-artifacts query', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: teacherUser } });
    supabaseSingleMock.mockResolvedValue({ data: teacherProfile });
    getDraftArtifactsForTeacherMock.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const ui = await TeacherPortfolioPage({
      searchParams: Promise.resolve({
        classId: '11111111-1111-1111-1111-111111111111',
        studentId: '22222222-2222-2222-2222-222222222222',
        from: '2026-04-01',
        to: '2026-04-30',
      }),
    });
    render(ui);

    expect(getDraftArtifactsForTeacherMock).toHaveBeenCalledWith(
      supabase,
      {
        classId: '11111111-1111-1111-1111-111111111111',
        studentId: '22222222-2222-2222-2222-222222222222',
        // April is fully inside Romania's DST (EEST, UTC+3), so a local-day
        // 2026-04-01..2026-04-30 range maps to 2026-03-31T21:00Z..2026-04-30T20:59:59.999Z.
        createdAfter: '2026-03-31T21:00:00.000Z',
        createdBefore: '2026-04-30T20:59:59.999Z',
        limit: 100,
      },
    );
  });

  it('renders the load-more control when the query returns a next cursor', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: teacherUser } });
    supabaseSingleMock.mockResolvedValue({ data: teacherProfile });
    getDraftArtifactsForTeacherMock.mockResolvedValue({
      items: [
        {
          id: 'art-1',
          studentId: 'stu-1',
          classId: 'cls-1',
          title: 'Castelul fermecat',
          artifactType: 'drawing',
          storagePath: 'students/stu-1/x.png',
          visibility: 'draft',
          reviewedBy: null,
          reviewedAt: null,
          metadata: {},
          createdAt: '2026-04-15T09:30:00.000Z',
          updatedAt: '2026-04-15T09:30:00.000Z',
        },
      ],
      nextCursor: 'cursor-2',
    });

    const ui = await TeacherPortfolioPage({
      searchParams: Promise.resolve({}),
    });
    render(ui);

    expect(
      screen.getByRole('button', { name: /încarcă mai multe/i }),
    ).toBeInTheDocument();
  });
});
