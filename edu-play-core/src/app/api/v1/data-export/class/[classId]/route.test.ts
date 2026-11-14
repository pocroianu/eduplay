import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRoleMock = vi.fn();

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    requireRole: (role: string) => requireRoleMock(role),
  };
});

const classId = '11111111-1111-4111-8111-111111111111';
const studentId = '22222222-2222-4222-8222-222222222222';

async function callGet() {
  const { GET } = await import('./route');
  return GET(new Request(`http://localhost/api/v1/data-export/class/${classId}`), {
    params: Promise.resolve({ classId }),
  });
}

function queryResult(data: unknown) {
  return Promise.resolve({ data });
}

describe('GET /api/v1/data-export/class/[classId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes canonical Activity Progress in class exports', async () => {
    const classRow = {
      id: classId,
      name: 'Clasa A',
      description: null,
      grade_level: 'grade-1',
      school_year: '2026',
      is_active: true,
      created_at: '2026-05-01T00:00:00.000Z',
    };
    const studentRow = {
      id: studentId,
      username: 'ana',
      avatar_url: null,
      created_at: '2026-05-01T00:00:00.000Z',
    };
    const activityProgressRow = {
      id: '33333333-3333-4333-8333-333333333333',
      student_id: studentId,
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
        if (table === 'classes') {
          const builder = {
            select: () => builder,
            eq: () => builder,
            single: () => queryResult(classRow),
          };
          return builder;
        }

        if (table === 'students') {
          return {
            select: () => ({
              eq: () => queryResult([studentRow]),
            }),
          };
        }


        if (table === 'activity_progress') {
          return {
            select: () => ({
              in: () => queryResult([activityProgressRow]),
            }),
          };
        }

        if (table === 'assignments') {
          return {
            select: () => ({
              eq: () => queryResult([]),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: '77777777-7777-4777-8777-777777777777' },
      profile: { role: 'teacher' },
    });

    const res = await callGet();

    expect(requireRoleMock).toHaveBeenCalledWith('teacher');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.students).toEqual([
      expect.objectContaining({
        id: studentId,
        activityProgress: [
          expect.objectContaining({
            activityId: activityProgressRow.activity_id,
            lastVersionId: activityProgressRow.last_version_id,
          }),
        ],
      }),
    ]);
  });
});
