import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAuthMock = vi.fn();

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    requireAuth: () => requireAuthMock(),
  };
});

async function callGet() {
  const { GET } = await import('./route');
  return GET(new Request('http://localhost/api/v1/data-export/me'));
}

function queryResult(data: unknown) {
  return Promise.resolve({ data });
}

describe('GET /api/v1/data-export/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes canonical Activity Progress in student exports', async () => {
    const studentRow = {
      id: '11111111-1111-4111-8111-111111111111',
      username: 'ana',
      class_id: '22222222-2222-4222-8222-222222222222',
      avatar_url: null,
      created_at: '2026-05-01T00:00:00.000Z',
    };
    const activityProgressRow = {
      id: '33333333-3333-4333-8333-333333333333',
      activity_id: '44444444-4444-4444-8444-444444444444',
      last_version_id: '55555555-5555-4555-8555-555555555555',
      status: 'completed',
      score: 90,
      time_spent: 120,
      attempts: 2,
      completed_at: '2026-05-02T00:00:00.000Z',
      created_at: '2026-05-01T00:00:00.000Z',
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'students') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: () => queryResult(studentRow) }),
            }),
          };
        }


        if (table === 'activity_progress') {
          return {
            select: () => ({
              eq: () => queryResult([activityProgressRow]),
            }),
          };
        }

        if (table === 'assignments') {
          return {
            select: () => ({
              eq: () =>
                queryResult([
                  {
                    id: '77777777-7777-4777-8777-777777777777',
                    activity_id: '44444444-4444-4444-8444-444444444444',
                    version_id: '55555555-5555-4555-8555-555555555555',
                    due_date: null,
                    is_mandatory: true,
                    created_at: '2026-05-01T00:00:00.000Z',
                  },
                ]),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: studentRow.id, email: undefined },
      profile: {
        id: studentRow.id,
        full_name: 'Ana',
        role: 'student',
      },
    });

    const res = await callGet();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.activityProgress).toEqual([
      expect.objectContaining({
        activityId: activityProgressRow.activity_id,
        lastVersionId: activityProgressRow.last_version_id,
      }),
    ]);
    expect(body.data.assignments).toEqual([
      expect.objectContaining({
        activityId: activityProgressRow.activity_id,
        versionId: activityProgressRow.last_version_id,
      }),
    ]);
  });
});
