import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Artifact } from '@/features/portfolio';

const requireRoleMock = vi.fn();
const getDraftArtifactsForTeacherMock = vi.fn();
const getSignedUrlsForArtifactsMock = vi.fn();

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    requireRole: (role: string) => requireRoleMock(role),
  };
});

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

const artifact: Artifact = {
  id: '11111111-1111-4111-8111-111111111111',
  studentId: '22222222-2222-4222-8222-222222222222',
  classId: '33333333-3333-4333-8333-333333333333',
  title: 'Casa mea',
  artifactType: 'drawing',
  storagePath: 'students/222/x.png',
  visibility: 'draft',
  reviewedBy: null,
  reviewedAt: null,
  metadata: {},
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

async function callGet(search = '') {
  const { GET } = await import('./route');
  return GET(
    new Request(`http://localhost/api/v1/teacher/portfolio/drafts${search}`),
  );
}

describe('GET /api/v1/teacher/portfolio/drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockResolvedValue({
      supabase: { from: vi.fn() },
      user: { id: 'teacher-1' },
      profile: { role: 'teacher' },
    });
    getDraftArtifactsForTeacherMock.mockResolvedValue({
      items: [artifact],
      nextCursor: 'cursor-2',
    });
    getSignedUrlsForArtifactsMock.mockResolvedValue({
      [artifact.id]: 'https://signed.test/artifact.png',
    });
  });

  it('requires teacher role and returns draft artifacts with nextCursor meta', async () => {
    const res = await callGet(
      '?cursor=cursor-1&limit=25&classId=33333333-3333-4333-8333-333333333333&from=2026-05-01',
    );

    expect(requireRoleMock).toHaveBeenCalledWith('teacher');
    expect(getDraftArtifactsForTeacherMock).toHaveBeenCalledWith(
      { from: expect.any(Function) },
      expect.objectContaining({
        classId: '33333333-3333-4333-8333-333333333333',
        cursor: 'cursor-1',
        limit: 25,
        createdAfter: '2026-04-30T21:00:00.000Z',
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(getSignedUrlsForArtifactsMock).toHaveBeenCalledWith(
      { from: expect.any(Function) },
      [artifact],
    );
    expect(body).toEqual({
      data: [artifact],
      error: null,
      meta: {
        nextCursor: 'cursor-2',
        mediaUrls: { [artifact.id]: 'https://signed.test/artifact.png' },
      },
    });
  });
});
