import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAssignedGames } from './getGames';

const createClientMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClientMock(),
}));

type Row = Record<string, unknown>;

class Query {
  private readonly filters: Array<[string, unknown]> = [];

  constructor(private readonly rows: Row[]) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  or() {
    return this;
  }

  single() {
    const row = this.execute()[0] ?? null;
    return Promise.resolve({
      data: row,
      error: row ? null : { message: 'not found' },
    });
  }

  then(
    onFulfilled: (value: { data: Row[]; error: null }) => unknown,
  ) {
    return Promise.resolve({ data: this.execute(), error: null }).then(onFulfilled);
  }

  private execute() {
    return this.rows.filter((row) =>
      this.filters.every(([column, value]) => row[column] === value),
    );
  }
}

function makeSupabase(tables: Record<string, Row[]>) {
  return {
    from: vi.fn((table: string) => new Query(tables[table] ?? [])),
  };
}

describe('getAssignedGames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds pinned CMS launch links from Activity assignment metadata', async () => {
    createClientMock.mockReturnValue(
      makeSupabase({
        students: [{ id: 'student-1', class_id: 'class-1' }],
        assignments: [
          {
            id: 'assignment-1',
            activity_id: 'activity-1',
            version_id: 'old-version',
            activities: {
              id: 'activity-1',
              title: 'Pinned activity',
              description: null,
              thumbnail_url: null,
              category: 'math',
              difficulty: 'easy',
              target_age_min: null,
              target_age_max: null,
              estimated_duration: null,
              skills: null,
              tags: null,
              is_published: true,
              created_at: '2026-05-01T00:00:00Z',
              updated_at: '2026-05-01T00:00:00Z',
            },
          },
        ],
      }),
    );

    await expect(getAssignedGames('student-1')).resolves.toMatchObject([
      {
        id: 'activity-1',
        launchHref: '/play/activity-1?assignmentId=assignment-1',
      },
    ]);
  });
});
