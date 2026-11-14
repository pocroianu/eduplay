import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEditorData } from './page';

const createClientMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClientMock(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

const activity = {
  id: 'activity-1',
  template: 'listen-tap',
  game_id: 'listen-01',
  title: 'Ascultă',
  description: null,
  thumbnail_url: null,
  default_lang: 'ro',
  default_theme: null,
  category: 'română',
  difficulty: 'easy',
  target_age_min: null,
  target_age_max: null,
  estimated_duration: null,
  question_count: null,
  tags: [],
  subject: 'română',
  skills: [],
  is_published: false,
  status: 'draft',
  config_data: {
    question: 'Alege sunetul',
    audio_url: '/audio/draft.mp3',
    nested_config: { target_word: 'casă' },
  },
  config_schema_version: 2,
  created_by: 'admin-1',
  created_at: '2026-05-08T00:00:00.000Z',
  updated_at: '2026-05-08T00:00:00.000Z',
};

const activityType = {
  type_id: 'listen-tap',
  display_name: 'Listen Tap',
  category: 'română',
  config_schema: {
    type: 'object',
    properties: {
      audio_url: { type: 'string' },
    },
  },
  renderer_key: 'listen-tap',
  renderer_kind: 'iframe',
  authoring_mode: 'admin-only',
  produces_submission: false,
  supports_review: false,
  is_auto_scored: true,
  version: 2,
  created_at: '2026-05-08T00:00:00.000Z',
  updated_at: '2026-05-08T00:00:00.000Z',
};

const version = {
  id: 'version-1',
  activity_id: 'activity-1',
  version_number: 1,
  config_data: {
    question: 'Versiune publicată',
    audio_url: '/audio/version.mp3',
    nested_config: { target_word: 'masă' },
  },
  config_schema_version: 1,
  activity_type_id: 'listen-tap',
  published_by_user_id: 'admin-1',
  published_at: '2026-05-08T01:00:00.000Z',
};

class Query {
  private filters: Array<[string, unknown]> = [];
  private orderColumn: string | null = null;
  private ascending = true;
  private rangeStart: number | null = null;
  private rangeEnd: number | null = null;

  constructor(
    private readonly store: Store,
    private readonly table: string,
  ) {}

  select() {
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

  single() {
    const rows = this.executeRows();
    return Promise.resolve({
      data: rows[0] ?? null,
      error: rows[0] ? null : { message: 'not found' },
    });
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({
      data: this.executeRows(),
      error: null,
    }).then(onfulfilled, onrejected);
  }

  private executeRows(): Row[] {
    let rows = this.store[this.table].filter((row) =>
      this.filters.every(([column, value]) => row[column] === value),
    );

    if (this.orderColumn) {
      rows = [...rows].sort((a, b) => {
        const av = a[this.orderColumn!];
        const bv = b[this.orderColumn!];
        if (av === bv) return 0;
        return (av as number) > (bv as number)
          ? this.ascending ? 1 : -1
          : this.ascending ? -1 : 1;
      });
    }

    if (this.rangeStart !== null && this.rangeEnd !== null) {
      rows = rows.slice(this.rangeStart, this.rangeEnd + 1);
    }

    return rows;
  }
}

function makeSupabase() {
  const store: Store = {
    activities: [{ ...activity }],
    activity_types: [{ ...activityType }],
    activity_versions: [{ ...version }],
  };

  return {
    from: (table: string) => new Query(store, table),
  };
}

describe('AdminCmsActivityEditorPage data loading', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('preserves draft and version config JSON keys when loading editor data', async () => {
    createClientMock.mockResolvedValue(makeSupabase());

    const data = await getEditorData('activity-1');

    expect(data.activity.configData).toEqual(activity.config_data);
    expect(data.activityType.configSchema).toEqual(activityType.config_schema);
    expect(data.versions[0].configData).toEqual(version.config_data);
  });
});
