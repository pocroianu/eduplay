import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api';

const requireRoleMock = vi.fn();
const requireAuthMock = vi.fn();
const createClientMock = vi.fn();
const createAdminClientMock = vi.fn();
const recordAdminActionMock = vi.fn();

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    requireAuth: () => requireAuthMock(),
    requireRole: (...roles: string[]) => requireRoleMock(...roles),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClientMock(),
  createAdminClient: () => createAdminClientMock(),
}));

vi.mock('@/lib/admin/audit', () => ({
  recordAdminAction: (...args: unknown[]) => recordAdminActionMock(...args),
}));

type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

function parseOrExpression(expression: string): Array<Array<[string, unknown]>> {
  return expression
    .split('),and(')
    .map((part) => part.replace(/^and\(/, '').replace(/\)$/, ''))
    .map((group) =>
      group.split(',').map((condition) => {
        const [column, operator, rawValue] = condition.split('.');
        if (operator !== 'eq') throw new Error(`Unsupported fake filter: ${condition}`);
        const value = rawValue === 'true' ? true : rawValue === 'false' ? false : rawValue;
        return [column, value] as [string, unknown];
      }),
    );
}

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['question'],
  additionalProperties: false,
  properties: {
    question: { type: 'string', minLength: 1 },
    answerIndex: { type: 'integer', minimum: 0 },
  },
};

const activityType = {
  type_id: 'multiple-choice',
  display_name: 'Multiple choice',
  category: 'math',
  config_schema: schema,
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

const freeResponseSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['prompt', 'allowedTools', 'shareWithFamilyOnApproval'],
  additionalProperties: false,
  properties: {
    prompt: { type: 'string', minLength: 1, pattern: '\\S' },
    allowedTools: {
      type: 'object',
      required: ['text', 'drawing', 'voice'],
      additionalProperties: false,
      properties: {
        text: { type: 'boolean' },
        drawing: { type: 'boolean' },
        voice: { type: 'boolean' },
      },
    },
    shareWithFamilyOnApproval: { type: 'boolean' },
  },
  anyOf: [
    { properties: { allowedTools: { properties: { text: { const: true } } } } },
    { properties: { allowedTools: { properties: { drawing: { const: true } } } } },
    { properties: { allowedTools: { properties: { voice: { const: true } } } } },
  ],
};

const freeResponseActivityType = {
  ...activityType,
  type_id: 'free-response',
  display_name: 'Free response',
  category: 'creative',
  config_schema: freeResponseSchema,
  renderer_key: 'free-response',
  renderer_kind: 'react',
  authoring_mode: 'teacher-simple',
  produces_submission: true,
  supports_review: true,
  is_auto_scored: false,
  version: 1,
};

const dbBackedActivityType = {
  ...activityType,
  type_id: 'listen-tap',
  display_name: 'Listen Tap',
  category: 'română',
  renderer_key: 'listen-tap',
};

const activity = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  template: 'multiple-choice',
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
  visibility_scope: 'private',
  config_data: { question: 'Cât este jumătate din 4?' },
  config_schema_version: 2,
  created_by: 'admin-1',
  created_at: '2026-05-08T00:00:00.000Z',
  updated_at: '2026-05-08T00:00:00.000Z',
};

class Query {
  private filters: Array<[string, unknown]> = [];
  private orFilterGroups: Array<Array<[string, unknown]>> = [];
  private ltFilters: Array<[string, string]> = [];
  private ilikeFilters: Array<[string, string]> = [];
  private rangeStart: number | null = null;
  private rangeEnd: number | null = null;
  private orderColumn: string | null = null;
  private ascending = true;
  private limitCount: number | null = null;
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: Row | Row[] | null = null;
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

  or(expression: string) {
    this.orFilterGroups.push(...parseOrExpression(expression));
    return this;
  }

  lt(column: string, value: string) {
    this.ltFilters.push([column, value]);
    return this;
  }

  ilike(column: string, pattern: string) {
    this.ilikeFilters.push([column, pattern]);
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

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.op = 'insert';
    this.payload = payload;
    const rows = Array.isArray(payload) ? payload : [payload];
    this.store[this.table].push(
      ...rows.map((row, idx) => ({
        id: row.id ?? `generated-${this.store[this.table].length + idx + 1}`,
        ...row,
      })),
    );
    return this;
  }

  update(payload: Row) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  single() {
    const rows = this.executeRows();
    return Promise.resolve({
      data: rows[0] ?? null,
      error: rows[0] ? null : { message: 'not found' },
    });
  }

  maybeSingle() {
    const rows = this.executeRows();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({
      data: this.executeRows(),
      count: this.shouldCount ? this.executeRows(false).length : null,
      error: null,
    }).then(onfulfilled, onrejected);
  }

  private executeRows(applyWindow = true): Row[] {
    if (this.op === 'delete') {
      const deleted = this.store[this.table].filter((row) => this.matches(row));
      this.store[this.table] = this.store[this.table].filter((row) => !this.matches(row));
      return deleted;
    }

    if (this.op === 'update') {
      this.store[this.table] = this.store[this.table].map((row) =>
        this.matches(row) ? { ...row, ...(this.payload as Row) } : row,
      );
    }

    let rows =
      this.op === 'insert'
        ? this.store[this.table].slice(-(Array.isArray(this.payload) ? this.payload.length : 1))
        : this.store[this.table].filter((row) => this.matches(row));

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

    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    if (applyWindow && this.rangeStart !== null && this.rangeEnd !== null) {
      rows = rows.slice(this.rangeStart, this.rangeEnd + 1);
    }

    return rows;
  }

  private matches(row: Row): boolean {
    return (
      this.filters.every(([column, value]) => row[column] === value) &&
      (this.orFilterGroups.length === 0 ||
        this.orFilterGroups.some((group) =>
          group.every(([column, value]) => row[column] === value),
        )) &&
      this.ltFilters.every(([column, value]) => String(row[column]) < value) &&
      this.ilikeFilters.every(([column, pattern]) => {
        const raw = row[column];
        if (typeof raw !== 'string') return false;
        const needle = pattern.replaceAll('%', '').toLocaleLowerCase('ro-RO');
        return raw.toLocaleLowerCase('ro-RO').includes(needle);
      })
    );
  }
}

function makeSupabase(overrides: Partial<Store> = {}) {
  const store: Store = {
    activity_types: [{ ...activityType }],
    activities: [{ ...activity }],
    activity_versions: [],
    activity_preview_sessions: [],
    assignments: [],
    ...overrides,
  };

  const rpc = vi.fn(
    async (
      fn: string,
      args: Record<string, unknown>,
    ): Promise<{
      data: unknown;
      error: { code?: string; message: string } | null;
    }> => {
      if (fn !== 'create_activity_version_atomically') {
        return { data: null, error: null };
      }

      const current = store.activities.find((row) => row.id === args.p_activity_id);
      if (!current) {
        return {
          data: null,
          error: { code: 'P0002', message: 'activity not found' },
        };
      }
      if (current.status !== 'draft' || current.is_published === true) {
        return {
          data: null,
          error: { code: '23514', message: 'activity is not draft' },
        };
      }
      if (current.template !== args.p_activity_type_id) {
        return {
          data: null,
          error: { code: '40001', message: 'activity draft changed' },
        };
      }

      const latestVersion = store.activity_versions.reduce(
        (max, row) => Math.max(max, Number(row.version_number ?? 0)),
        0,
      );
      const row = {
        id: `generated-${store.activity_versions.length + 1}`,
        activity_id: args.p_activity_id,
        version_number: latestVersion + 1,
        config_data: args.p_config_data,
        config_schema_version: args.p_config_schema_version,
        activity_type_id: args.p_activity_type_id,
        published_by_user_id: args.p_actor_id,
        published_at: '2026-05-08T01:00:00.000Z',
      };
      store.activity_versions.push(row);
      return { data: row, error: null };
    },
  );

  return {
    store,
    rpc,
    from: (table: string) => new Query(store, table),
  };
}

function jsonReq(url: string, body?: unknown) {
  return new Request(url, {
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('CMS activity API routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    recordAdminActionMock.mockResolvedValue(undefined);
    createAdminClientMock.mockReset();
    process.env.CMS_PREVIEW_TOKEN_SECRET = 'test-secret';

    const supabase = makeSupabase();
    createClientMock.mockReturnValue(supabase);
    createAdminClientMock.mockReturnValue(supabase);
    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
  });

  it('lists public activity types in the API envelope', async () => {
    const { GET } = await import('@/app/api/v1/activity-types/route');
    const res = await GET(jsonReq('http://localhost/api/v1/activity-types'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data[0]).toMatchObject({
      typeId: 'multiple-choice',
      configSchema: schema,
    });
  });

  it('returns a single public activity type by id', async () => {
    const { GET } = await import('@/app/api/v1/activity-types/[typeId]/route');
    const res = await GET(jsonReq('http://localhost/api/v1/activity-types/multiple-choice'), {
      params: Promise.resolve({ typeId: 'multiple-choice' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.typeId).toBe('multiple-choice');
  });

  it('denies non-admin access to activity versions', async () => {
    requireRoleMock.mockRejectedValue(ApiError.forbidden());
    const { GET } = await import('@/app/api/v1/activities/[id]/versions/route');

    const res = await GET(jsonReq(`http://localhost/api/v1/activities/${activity.id}/versions`), {
      params: Promise.resolve({ id: activity.id as string }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('preserves activity version config_data key casing when listing snapshots', async () => {
    const supabase = makeSupabase({
      activity_versions: [
        {
          id: 'version-1',
          activity_id: activity.id,
          version_number: 1,
          config_data: {
            question: 'Versiune',
            audio_url: '/audio/version.mp3',
            nested_config: { target_word: 'casă' },
          },
          config_schema_version: 2,
          activity_type_id: 'multiple-choice',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-08T01:00:00.000Z',
        },
      ],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { GET } = await import('@/app/api/v1/activities/[id]/versions/route');

    const res = await GET(jsonReq(`http://localhost/api/v1/activities/${activity.id}/versions`), {
      params: Promise.resolve({ id: activity.id as string }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].configData).toEqual({
      question: 'Versiune',
      audio_url: '/audio/version.mp3',
      nested_config: { target_word: 'casă' },
    });
  });

  it('creates a draft version after validating config_data', async () => {
    const supabase = makeSupabase();
    createAdminClientMock.mockReturnValue(supabase);
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/versions/route');

    const res = await POST(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/versions`, {
        configData: { question: 'Întrebare nouă' },
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject({
      activityId: activity.id,
      activityTypeId: 'multiple-choice',
      versionNumber: 1,
      configSchemaVersion: 2,
    });
  });

  it('preserves config_data key casing when writing JSON payloads', async () => {
    const supabase = makeSupabase();
    createAdminClientMock.mockReturnValue(supabase);
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/versions/route');

    const res = await POST(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/versions`, {
        configData: { question: 'Întrebare nouă', answerIndex: 0 },
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(201);
    expect(supabase.store.activity_versions[0].config_data).toEqual({
      question: 'Întrebare nouă',
      answerIndex: 0,
    });
  });

  it('creates standalone versions through the atomic service RPC after draft validation', async () => {
    const supabase = makeSupabase();
    const adminSupabase = makeSupabase();
    createAdminClientMock.mockReturnValue(adminSupabase);
    vi.mocked(adminSupabase.rpc).mockResolvedValue({
      data: {
        id: 'version-atomic',
        activity_id: activity.id,
        version_number: 1,
        config_data: { question: 'Întrebare atomică', answerIndex: 0 },
        config_schema_version: 2,
        activity_type_id: 'multiple-choice',
        published_by_user_id: 'admin-1',
        published_at: '2026-05-08T01:00:00.000Z',
      },
      error: null,
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/versions/route');

    const res = await POST(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/versions`, {
        configData: { question: 'Întrebare atomică', answerIndex: 0 },
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(201);
    expect(supabase.store.activity_versions).toHaveLength(0);
    expect(adminSupabase.rpc).toHaveBeenCalledWith(
      'create_activity_version_atomically',
      {
        p_activity_id: activity.id,
        p_activity_type_id: 'multiple-choice',
        p_config_data: { question: 'Întrebare atomică', answerIndex: 0 },
        p_config_schema_version: 2,
        p_actor_id: 'admin-1',
      },
    );
  });

  it('rejects standalone versions when the atomic RPC observes a stale non-draft row', async () => {
    const supabase = makeSupabase();
    const adminSupabase = makeSupabase();
    createAdminClientMock.mockReturnValue(adminSupabase);
    vi.mocked(adminSupabase.rpc).mockResolvedValue({
      data: null,
      error: { code: '23514', message: 'activity is not draft' },
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/versions/route');

    const res = await POST(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/versions`, {
        configData: { question: 'Snapshot întârziat' },
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFLICT');
    expect(supabase.store.activity_versions).toHaveLength(0);
    expect(adminSupabase.rpc).toHaveBeenCalledWith(
      'create_activity_version_atomically',
      expect.objectContaining({ p_activity_id: activity.id }),
    );
  });

  it('rejects draft versions when config_data fails the type schema', async () => {
    const { POST } = await import('@/app/api/v1/activities/[id]/versions/route');

    const res = await POST(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/versions`, {
        configData: { extra: true },
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects free-response version snapshots when all response tools are disabled', async () => {
    const supabase = makeSupabase({
      activity_types: [{ ...activityType }, { ...freeResponseActivityType }],
      activities: [{ ...activity, template: 'free-response' }],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/versions/route');

    const res = await POST(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/versions`, {
        configData: {
          prompt: 'Răspunde liber.',
          allowedTools: { text: false, drawing: false, voice: false },
          shareWithFamilyOnApproval: false,
        },
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects standalone version snapshots for published activities', async () => {
    const supabase = makeSupabase({
      activities: [
        {
          ...activity,
          status: 'published',
          is_published: true,
        },
      ],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/versions/route');

    const res = await POST(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/versions`, {
        configData: { question: 'Snapshot test' },
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFLICT');
    expect(supabase.store.activity_versions).toHaveLength(0);
  });

  it('publishes an activity by snapshotting the draft and flipping status', async () => {
    const supabase = makeSupabase();
    const adminSupabase = makeSupabase();
    createAdminClientMock.mockReturnValue(adminSupabase);
    vi.mocked(adminSupabase.rpc).mockResolvedValue({
      data: {
        activity: {
          ...activity,
          status: 'published',
          is_published: true,
          visibility_scope: 'public',
          config_schema_version: 2,
        },
        version: {
          id: 'version-1',
          activity_id: activity.id,
          version_number: 1,
          config_data: activity.config_data,
          config_schema_version: 2,
          activity_type_id: 'multiple-choice',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-09T00:00:00.000Z',
        },
      },
      error: null,
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/publish/route');

    const res = await POST(jsonReq(`http://localhost/api/v1/activities/${activity.id}/publish`), {
      params: Promise.resolve({ id: activity.id as string }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.activity.status).toBe('published');
    expect(body.data.activity.visibilityScope).toBe('public');
    expect(body.data.version.versionNumber).toBe(1);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(adminSupabase.rpc).toHaveBeenCalledWith('publish_activity_atomically', {
      p_activity_id: activity.id,
      p_activity_type_id: 'multiple-choice',
      p_config_data: activity.config_data,
      p_config_schema_version: 2,
      p_actor_id: 'admin-1',
      p_before_status: 'draft',
      p_before_is_published: false,
      p_before_config_schema_version: 2,
    });
    expect(recordAdminActionMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'activity_published' }),
    );
  });

  it.each(['archived', 'in_review'] as const)(
    'rejects publishing %s activities before the RPC runs',
    async (status) => {
      const supabase = makeSupabase({
        activities: [
          {
            ...activity,
            status,
            is_published: status === 'archived',
          },
        ],
      });
      requireRoleMock.mockResolvedValue({
        supabase,
        user: { id: 'admin-1', email: 'admin@example.com' },
        profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
      });
      const { POST } = await import('@/app/api/v1/activities/[id]/publish/route');

      const res = await POST(jsonReq(`http://localhost/api/v1/activities/${activity.id}/publish`), {
        params: Promise.resolve({ id: activity.id as string }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe('CONFLICT');
      expect(createAdminClientMock).not.toHaveBeenCalled();
      expect(supabase.rpc).not.toHaveBeenCalled();
      expect(supabase.store.activities[0]).toMatchObject({
        status,
        is_published: status === 'archived',
      });
    },
  );

  it('preserves config_data key casing in publish responses', async () => {
    const snakeConfig = {
      question: 'Ascultă',
      audio_url: '/audio/draft.mp3',
      nested_config: { target_word: 'casă' },
    };
    const supabase = makeSupabase({
      activity_types: [
        {
          ...activityType,
          config_schema: {
            type: 'object',
            required: ['question', 'audio_url'],
            additionalProperties: false,
            properties: {
              question: { type: 'string' },
              audio_url: { type: 'string' },
              nested_config: { type: 'object' },
            },
          },
        },
      ],
      activities: [{ ...activity, config_data: snakeConfig }],
    });
    const adminSupabase = makeSupabase();
    createAdminClientMock.mockReturnValue(adminSupabase);
    vi.mocked(adminSupabase.rpc).mockResolvedValue({
      data: {
        activity: {
          ...activity,
          status: 'published',
          is_published: true,
          config_data: snakeConfig,
        },
        version: {
          id: 'version-1',
          activity_id: activity.id,
          version_number: 1,
          config_data: snakeConfig,
          config_schema_version: 2,
          activity_type_id: 'multiple-choice',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-09T00:00:00.000Z',
        },
      },
      error: null,
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/publish/route');

    const res = await POST(jsonReq(`http://localhost/api/v1/activities/${activity.id}/publish`), {
      params: Promise.resolve({ id: activity.id as string }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.activity.configData).toEqual(snakeConfig);
    expect(body.data.version.configData).toEqual(snakeConfig);
  });

  it('does not publish when the atomic publish RPC fails', async () => {
    const supabase = makeSupabase();
    const adminSupabase = makeSupabase();
    createAdminClientMock.mockReturnValue(adminSupabase);
    vi.mocked(adminSupabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'audit_logs insert failed' },
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/publish/route');

    const res = await POST(jsonReq(`http://localhost/api/v1/activities/${activity.id}/publish`), {
      params: Promise.resolve({ id: activity.id as string }),
    });

    expect(res.status).toBe(500);
    expect(supabase.store.activities[0]).toMatchObject({
      status: 'draft',
      is_published: false,
    });
    expect(supabase.store.activity_versions).toHaveLength(0);
    expect(recordAdminActionMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'activity_published' }),
    );
  });

  it('creates an opaque preview session without returning draft JSON in the URL token', async () => {
    const supabase = makeSupabase();
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/preview/route');

    const res = await POST(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/preview`, {
        configData: { question: 'Preview secret draft' },
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({
      previewId: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(JSON.stringify(body.data)).not.toContain('Preview secret draft');
    expect(supabase.store.activity_preview_sessions[0]).toMatchObject({
      id: body.data.previewId,
      activity_id: activity.id,
      type_id: 'multiple-choice',
      config_data: { question: 'Preview secret draft' },
      created_by: 'admin-1',
    });
    expect(supabase.store.activity_versions).toHaveLength(0);
  });

  it('lets an owner teacher create an opaque preview session for their private free-response draft', async () => {
    const freeResponseConfig = {
      prompt: 'Desenează și povestește.',
      allowedTools: { text: true, drawing: true, voice: false },
      shareWithFamilyOnApproval: false,
    };
    const supabase = makeSupabase({
      activity_types: [{ ...freeResponseActivityType }],
      activities: [
        {
          ...activity,
          template: 'free-response',
          created_by: 'teacher-1',
          visibility_scope: 'private',
          config_data: freeResponseConfig,
          config_schema_version: 1,
        },
      ],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'teacher-1', email: 'teacher@example.com' },
      profile: { id: 'teacher-1', role: 'teacher', full_name: 'Teacher' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/preview/route');

    const res = await POST(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/preview`, {
        configData: freeResponseConfig,
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({
      previewId: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(JSON.stringify(body.data)).not.toContain('Desenează și povestește.');
    expect(supabase.store.activity_preview_sessions[0]).toMatchObject({
      id: body.data.previewId,
      activity_id: activity.id,
      type_id: 'free-response',
      config_data: freeResponseConfig,
      created_by: 'teacher-1',
    });
    expect(supabase.store.activity_versions).toHaveLength(0);
  });

  it('does not let a non-owner teacher create a preview session for another teacher private draft', async () => {
    const freeResponseConfig = {
      prompt: 'Secret',
      allowedTools: { text: true, drawing: false, voice: false },
      shareWithFamilyOnApproval: false,
    };
    const supabase = makeSupabase({
      activity_types: [{ ...freeResponseActivityType }],
      activities: [
        {
          ...activity,
          template: 'free-response',
          created_by: 'teacher-1',
          visibility_scope: 'private',
          config_data: freeResponseConfig,
          config_schema_version: 1,
        },
      ],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'teacher-2', email: 'teacher2@example.com' },
      profile: { id: 'teacher-2', role: 'teacher', full_name: 'Teacher 2' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/preview/route');

    const res = await POST(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/preview`, {
        configData: freeResponseConfig,
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(404);
    expect(supabase.store.activity_preview_sessions).toHaveLength(0);
  });

  it('serves preview config from the creating admin preview session without the API envelope', async () => {
    const supabase = makeSupabase({
      activity_preview_sessions: [
        {
          id: 'preview-session-1',
          activity_id: activity.id,
          type_id: 'multiple-choice',
          config_data: {
            question: 'Preview',
            answer_index: 0,
            nested_config: { audio_url: '/audio/preview.mp3' },
          },
          created_by: 'admin-1',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      ],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { GET } = await import('@/app/api/v1/activities/[id]/preview/config/route');

    const res = await GET(
      jsonReq(
        `http://localhost/api/v1/activities/${activity.id}/preview/config?previewId=preview-session-1`,
      ),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(await res.json()).toEqual({
      question: 'Preview',
      answer_index: 0,
      nested_config: { audio_url: '/audio/preview.mp3' },
    });
  });

  it('serves the latest published activity version config without an API envelope', async () => {
    const publishedConfig = {
      question: 'Publicat',
      audio_url: '/audio/published.mp3',
      nested_config: { target_word: 'casă' },
    };
    const draftConfig = {
      question: 'Draft nepublicat',
      audio_url: '/audio/draft.mp3',
    };
    const supabase = makeSupabase({
      activities: [
        {
          ...activity,
          is_published: true,
          status: 'published',
          visibility_scope: 'public',
          config_data: draftConfig,
        },
      ],
      activity_versions: [
        {
          id: 'version-1',
          activity_id: activity.id,
          version_number: 1,
          config_data: publishedConfig,
          config_schema_version: 2,
          activity_type_id: 'multiple-choice',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-08T01:00:00.000Z',
        },
        {
          id: 'version-2',
          activity_id: activity.id,
          version_number: 2,
          config_data: publishedConfig,
          config_schema_version: 2,
          activity_type_id: 'multiple-choice',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-08T02:00:00.000Z',
        },
      ],
    });
    createAdminClientMock.mockReturnValue(supabase);
    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: 'student-1', email: 'student@example.com' },
      profile: { id: 'student-1', role: 'student', full_name: 'Student' },
    });
    const { GET } = await import('@/app/api/v1/activities/[id]/config/route');

    const res = await GET(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/config?versionId=version-2`),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(await res.json()).toEqual(publishedConfig);
  });

  it('serves an assignment-pinned older published activity version config', async () => {
    const pinnedConfig = {
      question: 'Publicat fixat',
      audio_url: '/audio/pinned.mp3',
    };
    const latestConfig = {
      question: 'Publicat nou',
      audio_url: '/audio/latest.mp3',
    };
    const supabase = makeSupabase({
      activities: [
        {
          ...activity,
          is_published: true,
          status: 'published',
        },
      ],
      activity_versions: [],
      assignments: [
        {
          id: 'assignment-1',
          activity_id: activity.id,
          version_id: 'version-1',
          teacher_id: 'teacher-1',
        },
      ],
    });
    const adminSupabase = makeSupabase({
      activities: [
        {
          ...activity,
          is_published: true,
          status: 'published',
          visibility_scope: 'public',
        },
      ],
      activity_versions: [
        {
          id: 'version-1',
          activity_id: activity.id,
          version_number: 1,
          config_data: pinnedConfig,
          config_schema_version: 2,
          activity_type_id: 'multiple-choice',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-08T01:00:00.000Z',
        },
        {
          id: 'version-2',
          activity_id: activity.id,
          version_number: 2,
          config_data: latestConfig,
          config_schema_version: 2,
          activity_type_id: 'multiple-choice',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-08T02:00:00.000Z',
        },
      ],
    });
    createAdminClientMock.mockReturnValue(adminSupabase);
    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: 'student-1', email: 'student@example.com' },
      profile: { id: 'student-1', role: 'student', full_name: 'Student' },
    });
    const { GET } = await import('@/app/api/v1/activities/[id]/config/route');

    const res = await GET(
      jsonReq(
        `http://localhost/api/v1/activities/${activity.id}/config?versionId=version-1&assignmentId=assignment-1`,
      ),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(pinnedConfig);
  });

  it('rejects assignment-pinned private config when the assignment teacher does not own the activity', async () => {
    const privateConfig = {
      prompt: 'Secret privat',
      allowedTools: { text: true, drawing: false, voice: false },
      shareWithFamilyOnApproval: false,
    };
    const supabase = makeSupabase({
      activities: [],
      activity_versions: [],
      assignments: [
        {
          id: 'assignment-forged',
          activity_id: activity.id,
          version_id: 'version-private',
          teacher_id: 'teacher-2',
        },
      ],
    });
    const adminSupabase = makeSupabase({
      activities: [
        {
          ...activity,
          template: 'free-response',
          is_published: true,
          status: 'published',
          visibility_scope: 'private',
          created_by: 'teacher-1',
        },
      ],
      activity_versions: [
        {
          id: 'version-private',
          activity_id: activity.id,
          version_number: 1,
          config_data: privateConfig,
          config_schema_version: 1,
          activity_type_id: 'free-response',
          published_by_user_id: 'teacher-1',
          published_at: '2026-05-08T01:00:00.000Z',
        },
      ],
    });
    createAdminClientMock.mockReturnValue(adminSupabase);
    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: 'student-1', email: 'student@example.com' },
      profile: { id: 'student-1', role: 'student', full_name: 'Student' },
    });
    const { GET } = await import('@/app/api/v1/activities/[id]/config/route');

    const res = await GET(
      jsonReq(
        `http://localhost/api/v1/activities/${activity.id}/config?versionId=version-private&assignmentId=assignment-forged`,
      ),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(404);
  });

  it('serves pinned published config through the service client when RLS hides older versions', async () => {
    const publishedConfig = {
      question: 'Versiune publicată fixată',
      audio_url: '/audio/pinned.mp3',
    };
    const supabase = makeSupabase({
      activities: [
        {
          ...activity,
          is_published: true,
          status: 'published',
        },
      ],
      activity_versions: [],
    });
    const adminSupabase = makeSupabase({
      activities: [
        {
          ...activity,
          is_published: true,
          status: 'published',
        },
      ],
      activity_versions: [
        {
          id: 'version-pinned',
          activity_id: activity.id,
          version_number: 1,
          config_data: publishedConfig,
          config_schema_version: 2,
          activity_type_id: 'multiple-choice',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-08T01:00:00.000Z',
        },
      ],
    });
    createAdminClientMock.mockReturnValue(adminSupabase);
    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: 'student-1', email: 'student@example.com' },
      profile: { id: 'student-1', role: 'student', full_name: 'Student' },
    });
    const { GET } = await import('@/app/api/v1/activities/[id]/config/route');

    const res = await GET(
      jsonReq(
        `http://localhost/api/v1/activities/${activity.id}/config?versionId=version-pinned`,
      ),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(publishedConfig);
    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
  });

  it('rejects published config requests without a selected version id', async () => {
    const supabase = makeSupabase({
      activities: [
        {
          ...activity,
          is_published: true,
          status: 'published',
        },
      ],
    });
    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: 'student-1', email: 'student@example.com' },
      profile: { id: 'student-1', role: 'student', full_name: 'Student' },
    });
    const { GET } = await import('@/app/api/v1/activities/[id]/config/route');

    const res = await GET(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/config`),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cleans expired preview sessions through the service client across admins', async () => {
    const supabase = makeSupabase();
    const adminSupabase = makeSupabase({
      activity_preview_sessions: [
        {
          id: 'expired-other-admin',
          activity_id: activity.id,
          type_id: 'multiple-choice',
          config_data: { question: 'Expired' },
          created_by: 'other-admin',
          expires_at: new Date(Date.now() - 1000).toISOString(),
        },
        {
          id: 'active-other-admin',
          activity_id: activity.id,
          type_id: 'multiple-choice',
          config_data: { question: 'Active' },
          created_by: 'other-admin',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      ],
    });
    createAdminClientMock.mockReturnValue(adminSupabase);
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/preview/route');

    const res = await POST(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/preview`, {
        configData: { question: 'Preview after cleanup' },
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    expect(adminSupabase.store.activity_preview_sessions).toEqual([
      expect.objectContaining({ id: 'active-other-admin' }),
    ]);
    expect(supabase.store.activity_preview_sessions).toEqual([
      expect.objectContaining({
        config_data: { question: 'Preview after cleanup' },
        created_by: 'admin-1',
      }),
    ]);
  });

  it('serves preview config from the creating teacher preview session without the API envelope', async () => {
    const freeResponseConfig = {
      prompt: 'Preview profesor',
      allowedTools: { text: true, drawing: false, voice: false },
      shareWithFamilyOnApproval: false,
    };
    const supabase = makeSupabase({
      activity_preview_sessions: [
        {
          id: 'preview-session-1',
          activity_id: activity.id,
          type_id: 'free-response',
          config_data: freeResponseConfig,
          created_by: 'teacher-1',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      ],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'teacher-1', email: 'teacher@example.com' },
      profile: { id: 'teacher-1', role: 'teacher', full_name: 'Teacher' },
    });
    const { GET } = await import('@/app/api/v1/activities/[id]/preview/config/route');

    const res = await GET(
      jsonReq(
        `http://localhost/api/v1/activities/${activity.id}/preview/config?previewId=preview-session-1`,
      ),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(freeResponseConfig);
  });

  it('rejects preview sessions created by a different admin or teacher', async () => {
    const supabase = makeSupabase({
      activity_preview_sessions: [
        {
          id: 'preview-session-1',
          activity_id: activity.id,
          type_id: 'multiple-choice',
          config_data: { question: 'Leaked draft' },
          created_by: 'other-admin',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      ],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { GET } = await import('@/app/api/v1/activities/[id]/preview/config/route');

    const res = await GET(
      jsonReq(
        `http://localhost/api/v1/activities/${activity.id}/preview/config?previewId=preview-session-1`,
      ),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('rejects expired preview sessions', async () => {
    const supabase = makeSupabase({
      activity_preview_sessions: [
        {
          id: 'preview-session-1',
          activity_id: activity.id,
          type_id: 'multiple-choice',
          config_data: { question: 'Expired draft' },
          created_by: 'admin-1',
          expires_at: new Date(Date.now() - 1000).toISOString(),
        },
      ],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { GET } = await import('@/app/api/v1/activities/[id]/preview/config/route');

    const res = await GET(
      jsonReq(
        `http://localhost/api/v1/activities/${activity.id}/preview/config?previewId=preview-session-1`,
      ),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns a preview session id without writing activity_versions', async () => {
    const supabase = makeSupabase();
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/preview/route');

    const res = await POST(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}/preview`, {
        configData: { question: 'Preview' },
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.previewId).toEqual(expect.any(String));
    expect(body.data.expiresAt).toEqual(expect.any(String));
    expect(supabase.store.activity_versions).toHaveLength(0);
  });

  it('returns a preview token for DB-backed activity types', async () => {
    const listenTapActivity = {
      ...activity,
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      template: 'listen-tap',
      title: 'Sunete și litere',
      subject: 'română',
      config_data: { question: 'Ascultă sunetul' },
    };
    const supabase = makeSupabase({
      activity_types: [{ ...activityType }, { ...dbBackedActivityType }],
      activities: [listenTapActivity],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { POST } = await import('@/app/api/v1/activities/[id]/preview/route');

    const res = await POST(
      jsonReq(`http://localhost/api/v1/activities/${listenTapActivity.id}/preview`, {
        typeId: 'listen-tap',
        configData: { question: 'Preview listen tap' },
      }),
      { params: Promise.resolve({ id: listenTapActivity.id as string }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.previewId).toEqual(expect.any(String));
    expect(supabase.store.activity_versions).toHaveLength(0);
  });

  it('validates config_data on activity create', async () => {
    const { POST } = await import('@/app/api/v1/activities/route');

    const res = await POST(
      jsonReq('http://localhost/api/v1/activities', {
        typeId: 'multiple-choice',
        gameId: 'draft-1',
        title: 'Draft',
        configData: { extra: true },
      }),
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('exposes free-response activity type metadata', async () => {
    const supabase = makeSupabase({
      activity_types: [{ ...activityType }, { ...freeResponseActivityType }],
    });
    createClientMock.mockReturnValue(supabase);
    const { GET } = await import('@/app/api/v1/activity-types/[typeId]/route');

    const res = await GET(jsonReq('http://localhost/api/v1/activity-types/free-response'), {
      params: Promise.resolve({ typeId: 'free-response' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      typeId: 'free-response',
      rendererKey: 'free-response',
      rendererKind: 'react',
      authoringMode: 'teacher-simple',
      producesSubmission: true,
      supportsReview: true,
      isAutoScored: false,
    });
  });

  it('creates teacher free-response drafts as private owned activities', async () => {
    const supabase = makeSupabase({
      activity_types: [{ ...activityType }, { ...freeResponseActivityType }],
      activities: [],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'teacher-1', email: 'teacher@example.com' },
      profile: { id: 'teacher-1', role: 'teacher', full_name: 'Teacher' },
    });
    const { POST } = await import('@/app/api/v1/activities/route');

    const res = await POST(
      jsonReq('http://localhost/api/v1/activities', {
        typeId: 'free-response',
        title: 'Desenează primăvara',
        configData: {
          prompt: 'Arată ce îți place la primăvară.',
          allowedTools: { text: true, drawing: true, voice: true },
          shareWithFamilyOnApproval: false,
        },
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject({
      template: 'free-response',
      title: 'Desenează primăvara',
      visibilityScope: 'private',
      isPublished: false,
      createdBy: 'teacher-1',
      configSchemaVersion: 1,
    });
    expect(supabase.store.activities[0]).toMatchObject({
      template: 'free-response',
      visibility_scope: 'private',
      is_published: false,
      created_by: 'teacher-1',
    });
  });

  it('rejects teacher attempts to create public activities directly', async () => {
    const supabase = makeSupabase({
      activity_types: [{ ...activityType }, { ...freeResponseActivityType }],
      activities: [],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'teacher-1', email: 'teacher@example.com' },
      profile: { id: 'teacher-1', role: 'teacher', full_name: 'Teacher' },
    });
    const { POST } = await import('@/app/api/v1/activities/route');

    const res = await POST(
      jsonReq('http://localhost/api/v1/activities', {
        typeId: 'free-response',
        title: 'Public attempt',
        visibilityScope: 'public',
        configData: {
          prompt: 'Răspunde liber.',
          allowedTools: { text: true, drawing: false, voice: false },
          shareWithFamilyOnApproval: false,
        },
      }),
    );

    expect(res.status).toBe(403);
    expect(supabase.store.activities).toHaveLength(0);
  });

  it.each([
    {
      configData: {
        prompt: '   ',
        allowedTools: { text: true, drawing: false, voice: false },
        shareWithFamilyOnApproval: false,
      },
    },
    {
      configData: {
        prompt: 'Răspunde liber.',
        allowedTools: { text: false, drawing: false, voice: false },
        shareWithFamilyOnApproval: false,
      },
    },
  ])('rejects invalid free-response configs on create: %o', async (payload) => {
    const supabase = makeSupabase({
      activity_types: [{ ...activityType }, { ...freeResponseActivityType }],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'teacher-1', email: 'teacher@example.com' },
      profile: { id: 'teacher-1', role: 'teacher', full_name: 'Teacher' },
    });
    const { POST } = await import('@/app/api/v1/activities/route');

    const res = await POST(
      jsonReq('http://localhost/api/v1/activities', {
        typeId: 'free-response',
        title: 'Invalid',
        ...payload,
      }),
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unregistered DB-backed activity type ids on create even without config_data', async () => {
    const { POST } = await import('@/app/api/v1/activities/route');

    const res = await POST(
      jsonReq('http://localhost/api/v1/activities', {
        typeId: 'missing-type',
        gameId: 'draft-1',
        title: 'Draft',
      }),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it.each([
    { status: 'published' as const },
    { isPublished: true },
    { status: 'published' as const, isPublished: true },
  ])('rejects direct published creates through the generic POST route', async (payload) => {
    const { POST } = await import('@/app/api/v1/activities/route');

    const res = await POST(
      jsonReq('http://localhost/api/v1/activities', {
        typeId: 'multiple-choice',
        gameId: 'draft-1',
        title: 'Draft',
        configData: { question: 'Draft nou' },
        ...payload,
      }),
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFLICT');
  });

  it('filters the admin activity list by status, type and title search', async () => {
    const supabase = makeSupabase({
      activities: [
        { ...activity, id: 'draft-math', title: 'Fracții distractive' },
        {
          ...activity,
          id: 'published-letters',
          template: 'matching-game',
          title: 'Litere magice',
          subject: 'română',
          status: 'published',
          is_published: true,
        },
        {
          ...activity,
          id: 'archived-math',
          title: 'Fracții vechi',
          status: 'archived',
          is_published: false,
        },
      ],
    });
    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });

    const { GET } = await import('@/app/api/v1/activities/route');
    const res = await GET(
      jsonReq(
        'http://localhost/api/v1/activities?status=draft&typeId=multiple-choice&search=frac',
      ),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: 'draft-math',
      title: 'Fracții distractive',
      status: 'draft',
      template: 'multiple-choice',
    });
  });

  it('accepts DB-backed activity type ids when filtering the admin list', async () => {
    const supabase = makeSupabase({
      activity_types: [
        { ...activityType },
        {
          ...activityType,
          type_id: 'listen-tap',
          display_name: 'Ascultă și apasă',
          renderer_key: 'listen-tap',
        },
      ],
      activities: [
        { ...activity, id: 'legacy-template', title: 'Fracții distractive' },
        {
          ...activity,
          id: 'custom-type',
          template: 'listen-tap',
          title: 'Sunete și litere',
          subject: 'română',
        },
      ],
    });
    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });

    const { GET } = await import('@/app/api/v1/activities/route');
    const res = await GET(
      jsonReq('http://localhost/api/v1/activities?typeId=listen-tap'),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: 'custom-type',
      template: 'listen-tap',
    });
  });

  it('lists a teacher’s private activities with the public library, but not other private rows', async () => {
    const supabase = makeSupabase({
      activities: [
        {
          ...activity,
          id: 'own-private',
          title: 'Ciorna mea',
          created_by: 'teacher-1',
          visibility_scope: 'private',
        },
        {
          ...activity,
          id: 'other-private',
          title: 'Ciorna altuia',
          created_by: 'teacher-2',
          visibility_scope: 'private',
        },
        {
          ...activity,
          id: 'public-ready',
          title: 'Bibliotecă publică',
          created_by: 'admin-1',
          status: 'published',
          is_published: true,
          visibility_scope: 'public',
        },
      ],
    });
    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: 'teacher-1', email: 'teacher@example.com' },
      profile: { id: 'teacher-1', role: 'teacher', full_name: 'Teacher' },
    });
    const { GET } = await import('@/app/api/v1/activities/route');

    const res = await GET(jsonReq('http://localhost/api/v1/activities'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.map((row: { id: string }) => row.id).sort()).toEqual([
      'own-private',
      'public-ready',
    ]);
  });

  it('lets an owner teacher read and update their private free-response draft', async () => {
    const supabase = makeSupabase({
      activity_types: [{ ...activityType }, { ...freeResponseActivityType }],
      activities: [
        {
          ...activity,
          id: 'own-private',
          template: 'free-response',
          created_by: 'teacher-1',
          visibility_scope: 'private',
          config_data: {
            prompt: 'Răspuns inițial.',
            allowedTools: { text: true, drawing: false, voice: false },
            shareWithFamilyOnApproval: false,
          },
          config_schema_version: 1,
        },
      ],
    });
    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: 'teacher-1', email: 'teacher@example.com' },
      profile: { id: 'teacher-1', role: 'teacher', full_name: 'Teacher' },
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'teacher-1', email: 'teacher@example.com' },
      profile: { id: 'teacher-1', role: 'teacher', full_name: 'Teacher' },
    });

    const { GET, PATCH } = await import('@/app/api/v1/activities/[id]/route');
    const getRes = await GET(jsonReq('http://localhost/api/v1/activities/own-private'), {
      params: Promise.resolve({ id: 'own-private' }),
    });
    expect(getRes.status).toBe(200);

    const patchRes = await PATCH(
      jsonReq('http://localhost/api/v1/activities/own-private', {
        title: 'Ciornă actualizată',
        configData: {
          prompt: 'Răspunde cu desen sau voce.',
          allowedTools: { text: false, drawing: true, voice: true },
          shareWithFamilyOnApproval: true,
        },
      }),
      { params: Promise.resolve({ id: 'own-private' }) },
    );

    expect(patchRes.status).toBe(200);
    const body = await patchRes.json();
    expect(body.data).toMatchObject({
      title: 'Ciornă actualizată',
      visibilityScope: 'private',
      configSchemaVersion: 1,
    });
    expect(supabase.store.activities[0].config_data).toMatchObject({
      prompt: 'Răspunde cu desen sau voce.',
      allowedTools: { text: false, drawing: true, voice: true },
    });
  });

  it('hides private activities from non-owner teachers while keeping public activities readable', async () => {
    const supabase = makeSupabase({
      activities: [
        {
          ...activity,
          id: 'other-private',
          created_by: 'teacher-1',
          visibility_scope: 'private',
        },
        {
          ...activity,
          id: 'public-ready',
          created_by: 'admin-1',
          status: 'published',
          is_published: true,
          visibility_scope: 'public',
        },
      ],
    });
    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: 'teacher-2', email: 'teacher2@example.com' },
      profile: { id: 'teacher-2', role: 'teacher', full_name: 'Teacher 2' },
    });
    const { GET } = await import('@/app/api/v1/activities/[id]/route');

    const privateRes = await GET(jsonReq('http://localhost/api/v1/activities/other-private'), {
      params: Promise.resolve({ id: 'other-private' }),
    });
    expect(privateRes.status).toBe(404);

    const publicRes = await GET(jsonReq('http://localhost/api/v1/activities/public-ready'), {
      params: Promise.resolve({ id: 'public-ready' }),
    });
    expect(publicRes.status).toBe(200);
  });

  it('rejects teacher attempts to change readiness or visibility through PATCH', async () => {
    const supabase = makeSupabase({
      activity_types: [{ ...activityType }, { ...freeResponseActivityType }],
      activities: [
        {
          ...activity,
          id: 'own-private',
          template: 'free-response',
          created_by: 'teacher-1',
          visibility_scope: 'private',
          config_data: {
            prompt: 'Răspunde liber.',
            allowedTools: { text: true, drawing: false, voice: false },
            shareWithFamilyOnApproval: false,
          },
          config_schema_version: 1,
        },
      ],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'teacher-1', email: 'teacher@example.com' },
      profile: { id: 'teacher-1', role: 'teacher', full_name: 'Teacher' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const visibilityRes = await PATCH(
      jsonReq('http://localhost/api/v1/activities/own-private', { visibilityScope: 'public' }),
      { params: Promise.resolve({ id: 'own-private' }) },
    );
    expect(visibilityRes.status).toBe(403);

    const readyRes = await PATCH(
      jsonReq('http://localhost/api/v1/activities/own-private', { status: 'published' }),
      { params: Promise.resolve({ id: 'own-private' }) },
    );
    expect(readyRes.status).toBe(403);
  });

  it('archives an activity through PATCH instead of hard deleting it', async () => {
    const supabase = makeSupabase();
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const res = await PATCH(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}`, {
        status: 'archived',
        isPublished: false,
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      id: activity.id,
      status: 'archived',
      isPublished: false,
    });
    expect(supabase.store.activities[0]).toMatchObject({
      status: 'archived',
      is_published: false,
    });
  });

  it('mirrors lifecycle columns when archiving a published activity with status only', async () => {
    const supabase = makeSupabase({
      activities: [
        {
          ...activity,
          status: 'published',
          is_published: true,
        },
      ],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const res = await PATCH(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}`, {
        status: 'archived',
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    expect(supabase.store.activities[0]).toMatchObject({
      status: 'archived',
      is_published: false,
    });
  });

  it.each([
    { status: 'published' as const },
    { isPublished: true },
    { status: 'published' as const, isPublished: true },
  ])('rejects direct published transitions through the generic PATCH route', async (payload) => {
    const supabase = makeSupabase();
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const res = await PATCH(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}`, payload),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFLICT');
    expect(supabase.store.activities[0]).toMatchObject({
      status: 'draft',
      is_published: false,
    });
  });

  it('validates admin draft saves instead of routing them through the revert RPC', async () => {
    const supabase = makeSupabase();
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const res = await PATCH(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}`, {
        status: 'draft',
        isPublished: false,
        configData: { extra: true },
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(422);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it('preserves config_data key casing in PATCH responses', async () => {
    const snakeConfig = {
      question: 'Ascultă',
      audio_url: '/audio/draft.mp3',
      nested_config: { target_word: 'casă' },
    };
    const supabase = makeSupabase({
      activity_types: [
        {
          ...activityType,
          config_schema: {
            type: 'object',
            required: ['question', 'audio_url'],
            additionalProperties: false,
            properties: {
              question: { type: 'string' },
              audio_url: { type: 'string' },
              nested_config: { type: 'object' },
            },
          },
        },
      ],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const res = await PATCH(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}`, {
        configData: snakeConfig,
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.configData).toEqual(snakeConfig);
  });

  it('audits a version revert when PATCH restores config_data as a draft', async () => {
    const revertedConfig = { question: 'Versiune veche', answerIndex: 1 };
    const supabase = makeSupabase({
      activities: [
        {
          ...activity,
          status: 'published',
          is_published: true,
          config_data: { question: 'Curent publicat', answerIndex: 0 },
        },
      ],
      activity_versions: [
        {
          id: 'version-1',
          activity_id: activity.id,
          version_number: 1,
          config_data: revertedConfig,
          config_schema_version: 2,
          activity_type_id: 'multiple-choice',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-08T01:00:00.000Z',
        },
      ],
    });
    const adminSupabase = makeSupabase();
    createAdminClientMock.mockReturnValue(adminSupabase);
    vi.mocked(adminSupabase.rpc).mockResolvedValue({
      data: {
        activity: {
          ...activity,
          status: 'draft',
          is_published: false,
          config_data: { question: 'Versiune veche', answerIndex: 1 },
          config_schema_version: 2,
        },
      },
      error: null,
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const res = await PATCH(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}`, {
        status: 'draft',
        isPublished: false,
        revertVersionId: 'version-1',
        configData: revertedConfig,
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(adminSupabase.rpc).toHaveBeenCalledWith('revert_activity_atomically', {
      p_activity_id: activity.id,
      p_activity_type_id: 'multiple-choice',
      p_config_data: revertedConfig,
      p_config_schema_version: 2,
      p_actor_id: 'admin-1',
      p_before_status: 'published',
      p_before_is_published: true,
      p_before_config_schema_version: 2,
    });
    expect(recordAdminActionMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'activity_reverted' }),
    );
  });

  it('does not validate historical revert snapshots against the current activity type schema', async () => {
    const historicalConfig = {
      legacy_prompt: 'Ascultă sunetul vechi',
      audio_url: '/audio/legacy.mp3',
    };
    const supabase = makeSupabase({
      activity_versions: [
        {
          id: 'legacy-version',
          activity_id: activity.id,
          version_number: 1,
          config_data: historicalConfig,
          config_schema_version: 1,
          activity_type_id: 'multiple-choice',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-08T01:00:00.000Z',
        },
      ],
    });
    const adminSupabase = makeSupabase();
    createAdminClientMock.mockReturnValue(adminSupabase);
    vi.mocked(adminSupabase.rpc).mockResolvedValue({
      data: {
        activity: {
          ...activity,
          status: 'draft',
          is_published: false,
          config_data: historicalConfig,
          config_schema_version: 1,
        },
      },
      error: null,
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const res = await PATCH(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}`, {
        status: 'draft',
        isPublished: false,
        revertVersionId: 'legacy-version',
        typeId: 'multiple-choice',
        configSchemaVersion: 1,
        configData: historicalConfig,
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.configData).toEqual(historicalConfig);
    expect(adminSupabase.rpc).toHaveBeenCalledWith(
      'revert_activity_atomically',
      expect.objectContaining({
        p_config_data: historicalConfig,
        p_config_schema_version: 1,
      }),
    );
  });

  it('preserves config_data key casing in revert responses', async () => {
    const revertedConfig = {
      question: 'Versiune veche',
      audio_url: '/audio/old.mp3',
      nested_config: { target_word: 'masă' },
    };
    const supabase = makeSupabase({
      activity_types: [
        {
          ...activityType,
          config_schema: {
            type: 'object',
            required: ['question', 'audio_url'],
            additionalProperties: false,
            properties: {
              question: { type: 'string' },
              audio_url: { type: 'string' },
              nested_config: { type: 'object' },
            },
          },
        },
      ],
      activity_versions: [
        {
          id: 'version-snake',
          activity_id: activity.id,
          version_number: 1,
          config_data: revertedConfig,
          config_schema_version: 2,
          activity_type_id: 'multiple-choice',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-08T01:00:00.000Z',
        },
      ],
    });
    const adminSupabase = makeSupabase();
    createAdminClientMock.mockReturnValue(adminSupabase);
    vi.mocked(adminSupabase.rpc).mockResolvedValue({
      data: {
        activity: {
          ...activity,
          status: 'draft',
          is_published: false,
          config_data: revertedConfig,
        },
      },
      error: null,
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const res = await PATCH(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}`, {
        status: 'draft',
        isPublished: false,
        revertVersionId: 'version-snake',
        typeId: 'multiple-choice',
        configSchemaVersion: 2,
        configData: revertedConfig,
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.configData).toEqual(revertedConfig);
  });

  it('audits version reverts even when the current activity is not published', async () => {
    const revertedConfig = { question: 'Versiune veche', answerIndex: 1 };
    const supabase = makeSupabase({
      activities: [
        {
          ...activity,
          status: 'archived',
          is_published: false,
          config_data: { question: 'Arhivat curent', answerIndex: 0 },
        },
      ],
      activity_versions: [
        {
          id: 'version-archived',
          activity_id: activity.id,
          version_number: 1,
          config_data: revertedConfig,
          config_schema_version: 2,
          activity_type_id: 'multiple-choice',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-08T01:00:00.000Z',
        },
      ],
    });
    const adminSupabase = makeSupabase();
    createAdminClientMock.mockReturnValue(adminSupabase);
    vi.mocked(adminSupabase.rpc).mockResolvedValue({
      data: {
        activity: {
          ...activity,
          status: 'draft',
          is_published: false,
          config_data: { question: 'Versiune veche', answerIndex: 1 },
          config_schema_version: 2,
        },
      },
      error: null,
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const res = await PATCH(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}`, {
        status: 'draft',
        isPublished: false,
        revertVersionId: 'version-archived',
        configData: revertedConfig,
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(adminSupabase.rpc).toHaveBeenCalledWith(
      'revert_activity_atomically',
      expect.objectContaining({
        p_activity_id: activity.id,
        p_before_status: 'archived',
        p_before_is_published: false,
      }),
    );
  });

  it('does not revert when the atomic revert RPC fails', async () => {
    const revertedConfig = { question: 'Versiune veche', answerIndex: 1 };
    const supabase = makeSupabase({
      activities: [
        {
          ...activity,
          status: 'published',
          is_published: true,
          config_data: { question: 'Curent publicat', answerIndex: 0 },
        },
      ],
      activity_versions: [
        {
          id: 'version-fail',
          activity_id: activity.id,
          version_number: 1,
          config_data: revertedConfig,
          config_schema_version: 2,
          activity_type_id: 'multiple-choice',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-08T01:00:00.000Z',
        },
      ],
    });
    const adminSupabase = makeSupabase();
    createAdminClientMock.mockReturnValue(adminSupabase);
    vi.mocked(adminSupabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'audit_logs insert failed' },
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const res = await PATCH(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}`, {
        status: 'draft',
        isPublished: false,
        revertVersionId: 'version-fail',
        configData: revertedConfig,
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(500);
    expect(supabase.store.activities[0]).toMatchObject({
      status: 'published',
      is_published: true,
      config_data: { question: 'Curent publicat', answerIndex: 0 },
    });
  });

  it('keeps teacher draft config updates on the normal PATCH path', async () => {
    const supabase = makeSupabase({
      activity_types: [{ ...freeResponseActivityType }],
      activities: [
        {
          ...activity,
          template: 'free-response',
          config_schema_version: 1,
          config_data: {
            prompt: 'Inițial',
            allowedTools: { text: true, drawing: false, voice: false },
            shareWithFamilyOnApproval: false,
          },
          created_by: 'teacher-1',
          visibility_scope: 'private',
        },
      ],
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'teacher-1', email: 'teacher@example.com' },
      profile: { id: 'teacher-1', role: 'teacher', full_name: 'Teacher' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const res = await PATCH(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}`, {
        status: 'draft',
        isPublished: false,
        configData: {
          prompt: 'Editare profesor',
          allowedTools: { text: true, drawing: true, voice: false },
          shareWithFamilyOnApproval: false,
        },
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(supabase.store.activities[0]).toMatchObject({
      status: 'draft',
      is_published: false,
      config_data: {
        prompt: 'Editare profesor',
        allowedTools: { text: true, drawing: true, voice: false },
        shareWithFamilyOnApproval: false,
      },
    });
  });

  it('rejects unregistered DB-backed activity type ids on PATCH even without config_data', async () => {
    const supabase = makeSupabase();
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const res = await PATCH(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}`, {
        typeId: 'missing-type',
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('reverts DB-backed activity type snapshots with the historical renderer', async () => {
    const supabase = makeSupabase({
      activity_types: [{ ...activityType }, { ...dbBackedActivityType }],
      activities: [
        {
          ...activity,
          status: 'published',
          is_published: true,
          template: 'multiple-choice',
          config_data: { question: 'Curent publicat', answerIndex: 0 },
        },
      ],
      activity_versions: [
        {
          id: 'version-listen-tap',
          activity_id: activity.id,
          version_number: 1,
          config_data: { question: 'Versiune listen tap' },
          config_schema_version: 1,
          activity_type_id: 'listen-tap',
          published_by_user_id: 'admin-1',
          published_at: '2026-05-08T01:00:00.000Z',
        },
      ],
    });
    const adminSupabase = makeSupabase();
    createAdminClientMock.mockReturnValue(adminSupabase);
    vi.mocked(adminSupabase.rpc).mockResolvedValue({
      data: {
        activity: {
          ...activity,
          status: 'draft',
          is_published: false,
          template: 'listen-tap',
          config_data: { question: 'Versiune listen tap' },
          config_schema_version: 1,
        },
      },
      error: null,
    });
    requireRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'admin-1', email: 'admin@example.com' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin' },
    });
    const { PATCH } = await import('@/app/api/v1/activities/[id]/route');

    const res = await PATCH(
      jsonReq(`http://localhost/api/v1/activities/${activity.id}`, {
        status: 'draft',
        isPublished: false,
        revertVersionId: 'version-listen-tap',
        typeId: 'listen-tap',
        configSchemaVersion: 1,
        configData: { question: 'Versiune listen tap' },
      }),
      { params: Promise.resolve({ id: activity.id as string }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      template: 'listen-tap',
      configData: { question: 'Versiune listen tap' },
      configSchemaVersion: 1,
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(adminSupabase.rpc).toHaveBeenCalledWith('revert_activity_atomically', {
      p_activity_id: activity.id,
      p_activity_type_id: 'listen-tap',
      p_config_data: { question: 'Versiune listen tap' },
      p_config_schema_version: 1,
      p_actor_id: 'admin-1',
      p_before_status: 'published',
      p_before_is_published: true,
      p_before_config_schema_version: 2,
    });
  });
});
