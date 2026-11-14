import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Artifact } from '../types';
import { TeacherPortfolioQueue } from './TeacherPortfolioQueue';

const makeArtifact = (overrides: Partial<Artifact>): Artifact => ({
  id: '11111111-1111-4111-8111-111111111111',
  studentId: '22222222-2222-4222-8222-222222222222',
  classId: '33333333-3333-4333-8333-333333333333',
  title: 'Desen inițial',
  artifactType: 'drawing',
  storagePath: 'students/222/x.png',
  visibility: 'draft',
  reviewedBy: null,
  reviewedAt: null,
  metadata: {},
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TeacherPortfolioQueue', () => {
  it('loads the next cursor page and appends artifacts client-side', async () => {
    const initialArtifact = makeArtifact({ title: 'Desen inițial' });
    const nextArtifact = makeArtifact({
      id: '44444444-4444-4444-8444-444444444444',
      title: 'Pictură nouă',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [nextArtifact],
          error: null,
          meta: { nextCursor: null },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TeacherPortfolioQueue
        initialArtifacts={[initialArtifact]}
        initialNextCursor="cursor-1"
        filters={{
          classId: '33333333-3333-4333-8333-333333333333',
          from: '2026-05-01',
          studentId: undefined,
          to: undefined,
        }}
        classes={[
          { id: '33333333-3333-4333-8333-333333333333', name: 'Clasa Verde' },
        ]}
        students={[
          {
            id: '22222222-2222-4222-8222-222222222222',
            username: 'ana.matei',
          },
        ]}
        pageSize={1}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /încarcă mai multe/i }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/teacher/portfolio/drafts?cursor=cursor-1&limit=1&classId=33333333-3333-4333-8333-333333333333&from=2026-05-01',
      );
    });
    expect(
      screen.getByRole('heading', { name: 'Desen inițial' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Pictură nouă' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /încarcă mai multe/i }),
    ).not.toBeInTheDocument();
  });
});
