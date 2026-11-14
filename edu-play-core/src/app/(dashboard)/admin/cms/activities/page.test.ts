import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getInitialActivities } from './page';

const createClientMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClientMock(),
}));

type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

const activityType = {
  type_id: 'multiple-choice',
  display_name: 'Multiple choice',
  category: 'math',
  config_schema: {},
  renderer_key: 'multiple-choice',
  renderer_kind: 'iframe',
  authoring_mode: 'admin-only',
  produces_submission: false,
  supports_review: false,
  is_auto_scored: true,
  version: 2,
  created_at: '2026-05-08T00:00:00.000Z',
  updated_at: '2026-05-08T00:00:00.000Z',
};

function createActivity(overrides: Row = {}): Row {
  return {
    id: 'activity-1',
    template: 'multiple-choice',
    game_id: 'fractions-01',
    title: 'Fracții',
    description: null,
    thumbnail_url: null,
    default_lang: 'ro',
    default_theme: null,
    category: 'math',
    difficulty: 'easy',
    target_age_min: null,
    target_age_max: null,
    estimated_duration: null,
    question_count: null,
    tags: [],
    subject: 'math',
    skills: [],
    is_published: false,
    status: 'draft',
    config_data: {},
    config_schema_version: 2,
    created_by: 'admin-1',
    created_at: '2026-05-08T00:00:00.000Z',
    updated_at: '2026-05-08T00:00:00.000Z',
    ...overrides,
  };
}

class Query {
  private filters: Array<[string, unknown]> = [];
  private rangeStart: number | null = null;
  private rangeEnd: number | null = null;
  private orderColumn: string | null = null;
  private ascending = true;
  private shouldCount = false;

  constructor(
    private readonly store: Store,
    private readonly table: string,
  ) {}

  select(_columns = '*', options?: { count?: 'exact' }) {
    this.shouldCount = options?.count === 'exact';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.ascending = options?.ascending ?? true;
    return this;
  }

  range(from: number, to: number) {
    this.rangeStart = from;
    this.rangeEnd = to;
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const allRows = this.executeRows(false);
    return Promise.resolve({
      data: this.executeRows(true),
      count: this.shouldCount ? allRows.length : null,
      error: null,
    }).then(onfulfilled, onrejected);
  }

  private executeRows(applyWindow: boolean): Row[] {
    let rows = this.store[this.table].filter((row) =>
      this.filters.every(([column, value]) => row[column] === value),
    );

    if (this.orderColumn) {
      rows = [...rows].sort((a, b) => {
        const av = a[this.orderColumn!];
        const bv = b[this.orderColumn!];
        if (av === bv) return 0;
        return (av as string) > (bv as string)
          ? this.ascending ? 1 : -1
          : this.ascending ? -1 : 1;
      });
    }

    if (applyWindow && this.rangeStart !== null && this.rangeEnd !== null) {
      rows = rows.slice(this.rangeStart, this.rangeEnd + 1);
    }

    return rows;
  }
}

function makeSupabase(activities: Row[]) {
  const store = {
    activity_types: [{ ...activityType }],
    activities,
  };

  return {
    from: (table: string) => new Query(store, table),
  };
}

describe('AdminCmsActivitiesPage data loading', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('loads subject options and lifecycle counts from the full activity set', async () => {
    const activities = Array.from({ length: 25 }, (_, index) =>
      createActivity({
        id: `activity-${index + 1}`,
        subject: index < 20 ? 'math' : 'științe',
        status: index < 20 ? 'draft' : 'archived',
      }),
    );
    createClientMock.mockResolvedValue(makeSupabase(activities));

    const data = await getInitialActivities();

    expect(data.activities).toHaveLength(20);
    expect(data.meta.total).toBe(25);
    expect(data.subjectOptions).toEqual(['math', 'științe']);
    expect(data.statusCounts).toEqual({
      draft: 20,
      inReview: 0,
      published: 0,
      archived: 5,
    });
  });
});
