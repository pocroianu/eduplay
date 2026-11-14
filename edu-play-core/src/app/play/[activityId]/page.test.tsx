import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAdminClientMock = vi.fn();
const createClientMock = vi.fn();
const getPreviewSessionOrThrowMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => createAdminClientMock(),
  createClient: () => createClientMock(),
}));

vi.mock('@/features/games', () => ({
  GamePageContent: vi.fn(() => null),
}));

vi.mock('@/features/activities', () => ({
  FreeResponsePlayContent: vi.fn(() => null),
}));

vi.mock('@/features/activities/server', () => ({
  getPreviewSessionOrThrow: (...args: unknown[]) =>
    getPreviewSessionOrThrowMock(...args),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

type Row = Record<string, unknown>;

class Query {
  private readonly filters: Array<[string, unknown]> = [];
  private orderColumn: string | null = null;
  private ascending = true;
  private limitCount: number | null = null;

  constructor(
    private readonly rows: Row[],
  ) {}

  select(_columns = '*') {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.ascending = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    const row = this.executeRows()[0];

    return Promise.resolve({
      data: row ?? null,
      error: row ? null : { message: 'not found' },
    });
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({ data: this.executeRows(), error: null }).then(onfulfilled, onrejected);
  }

  private executeRows() {
    let rows = this.rows.filter((candidate) =>
      this.filters.every(([column, value]) => candidate[column] === value),
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

    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    return rows;
  }
}

function makeSupabase(input: {
  user: Row | null;
  profile: Row | null;
  activities: Row[];
  activityTypes?: Row[];
  previewSessions?: Row[];
  activityVersions?: Row[];
  activityResources?: Row[];
  assignments?: Row[];
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: input.user } }),
    },
    from(table: string) {
      if (table === 'profiles') {
        return new Query(input.profile ? [input.profile] : []);
      }
      if (table === 'activities') {
        return new Query(input.activities);
      }
      if (table === 'activity_types') {
        return new Query(input.activityTypes ?? []);
      }
      if (table === 'activity_preview_sessions') {
        return new Query(input.previewSessions ?? []);
      }
      if (table === 'activity_versions') {
        return new Query(input.activityVersions ?? []);
      }
      if (table === 'activity_resources') {
        return new Query(input.activityResources ?? []);
      }
      if (table === 'assignments') {
        return new Query(input.assignments ?? []);
      }
      return new Query([]);
    },
  };
}

const ACTIVITY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const activity = {
  id: ACTIVITY_ID,
  template: 'multiple-choice',
  title: 'Fracții',
  default_lang: 'ro',
  default_theme: null,
  category: 'math',
  difficulty: 'easy',
  estimated_duration: 8,
  is_published: false,
  status: 'draft',
  config_data: { question: 'Published snapshot' },
};

const activityType = {
  type_id: 'multiple-choice',
  display_name: 'Multiple choice',
  category: 'math',
  config_schema: {},
  renderer_key: 'multiple-choice',
  renderer_kind: 'iframe',
  version: 2,
  created_at: '2026-05-08T00:00:00.000Z',
  updated_at: '2026-05-08T00:00:00.000Z',
};

const freeResponseActivityType = {
  ...activityType,
  type_id: 'free-response',
  display_name: 'Free response',
  category: 'creative',
  renderer_key: 'free-response',
  renderer_kind: 'react',
  version: 1,
};

describe('/play/[activityId] preview session handling', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createAdminClientMock.mockReset();
    process.env.CMS_PREVIEW_TOKEN_SECRET = 'test-secret';
    getPreviewSessionOrThrowMock.mockImplementation(
      async (...args: unknown[]) => {
        const [supabase, input] = args as [
          ReturnType<typeof makeSupabase>,
          { previewId: string; activityId: string; actorId: string },
        ];
        const { data, error } = await supabase
          .from('activity_preview_sessions')
          .select('*')
          .eq('id', input.previewId)
          .eq('activity_id', input.activityId)
          .eq('created_by', input.actorId)
          .single();

        if (error || !data) throw new Error('preview not found');
        return {
          id: data.id,
          activityId: data.activity_id,
          typeId: data.type_id,
          configData: data.config_data,
          createdBy: data.created_by,
          expiresAt: data.expires_at,
        };
      },
    );
  });

  it('allows an admin with a valid preview session to render draft config through a scoped config URL', async () => {
    createClientMock.mockReturnValue(
      makeSupabase({
        user: { id: 'admin-1' },
        profile: { id: 'admin-1', role: 'admin' },
        activities: [activity],
        activityTypes: [activityType],
        previewSessions: [
          {
            id: 'preview-session-1',
            activity_id: ACTIVITY_ID,
            type_id: 'multiple-choice',
            config_data: { question: 'Draft preview', answerIndex: 0 },
            created_by: 'admin-1',
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          },
        ],
      }),
    );

    const { default: PlayPage } = await import('./page');
    const element = await PlayPage({
      params: Promise.resolve({ activityId: ACTIVITY_ID }),
      searchParams: Promise.resolve({ previewId: 'preview-session-1' }),
    });

    const props = (element as ReactElement<Record<string, unknown>>).props;
    const game = props.game as { game_url: string };
    const gameUrl = new URL(`http://localhost${game.game_url}`);

    expect(gameUrl.pathname).toBe('/api/v1/renderer-proxy/activity-renderers/multiple-choice/index.html');
    expect(gameUrl.searchParams.has('game')).toBe(false);
    expect(props.configUrl).toBe(
      `/api/v1/activities/${ACTIVITY_ID}/preview/config?previewId=preview-session-1`,
    );
    expect(props.studentId).toBeUndefined();
  });

  it('resolves DB-backed preview activity types to their renderer key', async () => {
    createClientMock.mockReturnValue(
      makeSupabase({
        user: { id: 'admin-1' },
        profile: { id: 'admin-1', role: 'admin' },
        activities: [{ ...activity, template: 'fractions-v2' }],
        activityTypes: [
          {
            ...activityType,
            type_id: 'fractions-v2',
            renderer_key: 'multiple-choice',
          },
        ],
        previewSessions: [
          {
            id: 'preview-session-1',
            activity_id: ACTIVITY_ID,
            type_id: 'fractions-v2',
            config_data: { question: 'Draft preview', answerIndex: 0 },
            created_by: 'admin-1',
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          },
        ],
      }),
    );

    const { default: PlayPage } = await import('./page');
    const element = await PlayPage({
      params: Promise.resolve({ activityId: ACTIVITY_ID }),
      searchParams: Promise.resolve({ previewId: 'preview-session-1' }),
    });

    const props = (element as ReactElement<Record<string, unknown>>).props;
    const game = props.game as { game_url: string };
    const gameUrl = new URL(`http://localhost${game.game_url}`);

    expect(gameUrl.pathname).toBe('/api/v1/renderer-proxy/activity-renderers/multiple-choice/index.html');
  });

  it('allows an owner teacher with a valid free-response preview session to render a React student-mode preview', async () => {
    createClientMock.mockReturnValue(
      makeSupabase({
        user: { id: 'teacher-1' },
        profile: { id: 'teacher-1', role: 'teacher' },
        activities: [
          {
            ...activity,
            template: 'free-response',
            title: 'Povestea mea',
            visibility_scope: 'private',
            created_by: 'teacher-1',
          },
        ],
        activityTypes: [freeResponseActivityType],
        previewSessions: [
          {
            id: 'preview-session-1',
            activity_id: ACTIVITY_ID,
            type_id: 'free-response',
            config_data: {
              prompt: 'Desenează și povestește.',
              allowedTools: { text: true, drawing: true, voice: false },
              shareWithFamilyOnApproval: false,
            },
            created_by: 'teacher-1',
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          },
        ],
      }),
    );

    const { default: PlayPage } = await import('./page');
    const { FreeResponsePlayContent } = await import('@/features/activities');

    const element = await PlayPage({
      params: Promise.resolve({ activityId: ACTIVITY_ID }),
      searchParams: Promise.resolve({ previewId: 'preview-session-1' }),
    });

    expect((element as ReactElement).type).toBe(FreeResponsePlayContent)
    expect((element as ReactElement<Record<string, unknown>>).props).toMatchObject({
      title: 'Povestea mea',
      backUrl: '/teacher/activities',
      mode: 'preview',
      config: {
        prompt: 'Desenează și povestește.',
        allowedTools: { text: true, drawing: true, voice: false },
        shareWithFamilyOnApproval: false,
      },
    })
  });

  it('does not let a non-owner teacher consume another teacher preview session', async () => {
    createClientMock.mockReturnValue(
      makeSupabase({
        user: { id: 'teacher-2' },
        profile: { id: 'teacher-2', role: 'teacher' },
        activities: [activity],
        activityTypes: [freeResponseActivityType],
        previewSessions: [
          {
            id: 'preview-session-1',
            activity_id: ACTIVITY_ID,
            type_id: 'free-response',
            config_data: { prompt: 'Secret' },
            created_by: 'teacher-1',
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          },
        ],
      }),
    );

    const { default: PlayPage } = await import('./page');

    await expect(
      PlayPage({
        params: Promise.resolve({ activityId: ACTIVITY_ID }),
        searchParams: Promise.resolve({ previewId: 'preview-session-1' }),
      }),
    ).rejects.toThrow('not-found');
  });

  it('routes seeded Phaser activities through the single Activity host renderer', async () => {
    createClientMock.mockReturnValue(
      makeSupabase({
        user: { id: 'student-1' },
        profile: { id: 'student-1', role: 'student' },
        activities: [
          {
            ...activity,
            template: 'multiple-choice',
            is_published: true,
            status: 'published',
          },
        ],
        activityTypes: [
          {
            ...activityType,
            renderer_key: 'activity-host',
          },
        ],
        activityVersions: [
          {
            id: 'version-1',
            activity_id: ACTIVITY_ID,
            version_number: 1,
            activity_type_id: 'multiple-choice',
            config_data: { question: 'Published snapshot' },
            config_schema_version: 2,
          },
        ],
      }),
    );

    const { default: PlayPage } = await import('./page');
    const element = await PlayPage({
      params: Promise.resolve({ activityId: ACTIVITY_ID }),
      searchParams: Promise.resolve({}),
    });

    const props = (element as ReactElement<Record<string, unknown>>).props;
    const game = props.game as { game_url: string };
    const gameUrl = new URL(`http://localhost${game.game_url}`);

    expect(gameUrl.pathname).toBe('/api/v1/renderer-proxy/activity-renderers/activity-host/templates/multiple-choice');
    expect(gameUrl.searchParams.get('hostCache')).toBe('asset-library-v2');
    expect(props.configUrl).toBe(
      `/api/v1/activities/${ACTIVITY_ID}/config?versionId=version-1`,
    );
  });

  it('passes the published activity config URL for normal play sessions', async () => {
    createClientMock.mockReturnValue(
      makeSupabase({
        user: { id: 'student-1' },
        profile: { id: 'student-1', role: 'student' },
        activities: [
          {
            ...activity,
            template: 'draft-type',
            is_published: true,
            status: 'published',
          },
        ],
        activityTypes: [activityType],
        activityVersions: [
          {
            id: 'version-1',
            activity_id: ACTIVITY_ID,
            version_number: 1,
            activity_type_id: 'multiple-choice',
            config_data: { question: 'Published snapshot' },
            config_schema_version: 2,
          },
        ],
      }),
    );

    const { default: PlayPage } = await import('./page');
    const element = await PlayPage({
      params: Promise.resolve({ activityId: ACTIVITY_ID }),
      searchParams: Promise.resolve({}),
    });

    const props = (element as ReactElement<Record<string, unknown>>).props;
    const game = props.game as { game_url: string };
    const gameUrl = new URL(`http://localhost${game.game_url}`);
    expect((props.game as { id: string }).id).toBe(ACTIVITY_ID);
    expect(gameUrl.pathname).toBe('/api/v1/renderer-proxy/activity-renderers/multiple-choice/index.html');
    expect(props.configUrl).toBe(
      `/api/v1/activities/${ACTIVITY_ID}/config?versionId=version-1`,
    );
    expect(props.activityId).toBe(ACTIVITY_ID);
    expect(props.versionId).toBe('version-1');
  });

  it('returns parents to the parent activity catalog after normal play sessions', async () => {
    createClientMock.mockReturnValue(
      makeSupabase({
        user: { id: 'parent-1' },
        profile: { id: 'parent-1', role: 'parent' },
        activities: [
          {
            ...activity,
            template: 'draft-type',
            is_published: true,
            status: 'published',
          },
        ],
        activityTypes: [activityType],
        activityVersions: [
          {
            id: 'version-1',
            activity_id: ACTIVITY_ID,
            version_number: 1,
            activity_type_id: 'multiple-choice',
            config_data: { question: 'Published snapshot' },
            config_schema_version: 2,
          },
        ],
      }),
    );

    const { default: PlayPage } = await import('./page');
    const element = await PlayPage({
      params: Promise.resolve({ activityId: ACTIVITY_ID }),
      searchParams: Promise.resolve({}),
    });

    const props = (element as ReactElement<Record<string, unknown>>).props;
    expect(props.backUrl).toBe('/parent/activities');
    expect(props.studentId).toBeUndefined();
  });

  it('passes assignment-pinned link resources into the free-response student renderer', async () => {
    const studentSupabase = makeSupabase({
      user: { id: 'student-1' },
      profile: { id: 'student-1', role: 'student' },
      activities: [
        {
          ...activity,
          template: 'free-response',
          title: 'Povestea cu resurse',
          is_published: true,
          status: 'published',
        },
      ],
      activityTypes: [freeResponseActivityType],
      assignments: [
        {
          id: 'assignment-1',
          student_id: 'student-1',
          class_id: null,
          activity_id: ACTIVITY_ID,
          version_id: 'version-1',
        },
      ],
      activityResources: [
        {
          id: 'resource-2',
          activity_id: ACTIVITY_ID,
          version_id: 'version-1',
          resource_type: 'link',
          title: 'Imagine model',
          url: 'https://example.test/model',
          sort_order: 2,
        },
        {
          id: 'resource-1',
          activity_id: ACTIVITY_ID,
          version_id: 'version-1',
          resource_type: 'link',
          title: 'Cântec',
          url: 'https://example.test/cantec',
          sort_order: 1,
        },
      ],
    });
    const adminSupabase = makeSupabase({
      user: null,
      profile: null,
      activities: [
        {
          ...activity,
          template: 'free-response',
          is_published: true,
          status: 'published',
        },
      ],
      activityVersions: [
        {
          id: 'version-1',
          activity_id: ACTIVITY_ID,
          version_number: 1,
          activity_type_id: 'free-response',
          config_data: {
            prompt: 'Citește resursele, apoi răspunde.',
            allowedTools: { text: true, drawing: false, voice: false },
            shareWithFamilyOnApproval: false,
          },
          config_schema_version: 1,
        },
      ],
    });
    createClientMock.mockReturnValue(studentSupabase);
    createAdminClientMock.mockReturnValue(adminSupabase);

    const { default: PlayPage } = await import('./page');
    const { FreeResponsePlayContent } = await import('@/features/activities');
    const element = await PlayPage({
      params: Promise.resolve({ activityId: ACTIVITY_ID }),
      searchParams: Promise.resolve({ assignmentId: 'assignment-1' }),
    });

    expect((element as ReactElement).type).toBe(FreeResponsePlayContent);
    expect((element as ReactElement<Record<string, unknown>>).props).toMatchObject({
      config: {
        prompt: 'Citește resursele, apoi răspunde.',
        resources: [
          { title: 'Cântec', url: 'https://example.test/cantec' },
          { title: 'Imagine model', url: 'https://example.test/model' },
        ],
      },
    });
  });

  it('uses the assignment-pinned version when assignmentId is provided', async () => {
    const studentSupabase = makeSupabase({
        user: { id: 'student-1' },
        profile: { id: 'student-1', role: 'student' },
        activities: [
          {
            ...activity,
            is_published: true,
            status: 'published',
          },
        ],
        activityTypes: [activityType],
        assignments: [
          {
            id: 'assignment-1',
            student_id: 'student-1',
            class_id: null,
            activity_id: ACTIVITY_ID,
            version_id: 'version-1',
          },
        ],
        activityVersions: [
          {
            id: 'version-2',
            activity_id: ACTIVITY_ID,
            version_number: 2,
            activity_type_id: 'multiple-choice',
            config_data: { question: 'Newer snapshot' },
            config_schema_version: 2,
          },
        ],
      });
    const adminSupabase = makeSupabase({
      user: null,
      profile: null,
      activities: [
        {
          ...activity,
          is_published: true,
          status: 'published',
        },
      ],
      activityVersions: [
        {
          id: 'version-1',
          activity_id: ACTIVITY_ID,
          version_number: 1,
          activity_type_id: 'multiple-choice',
          config_data: { question: 'Original pinned snapshot' },
          config_schema_version: 2,
        },
      ],
    });
    createClientMock.mockReturnValue(studentSupabase);
    createAdminClientMock.mockReturnValue(adminSupabase);

    const { default: PlayPage } = await import('./page');
    const element = await PlayPage({
      params: Promise.resolve({ activityId: ACTIVITY_ID }),
      searchParams: Promise.resolve({ assignmentId: 'assignment-1' }),
    });

    const props = (element as ReactElement<Record<string, unknown>>).props;
    expect(props.configUrl).toBe(
      `/api/v1/activities/${ACTIVITY_ID}/config?versionId=version-1&assignmentId=assignment-1`,
    );
    expect(props.activityId).toBe(ACTIVITY_ID);
    expect(props.versionId).toBe('version-1');
    expect(props.assignmentId).toBe('assignment-1');
  });

  it('rejects an assignment pinned to a different activity', async () => {
    createClientMock.mockReturnValue(
      makeSupabase({
        user: { id: 'student-1' },
        profile: { id: 'student-1', role: 'student' },
        activities: [
          {
            ...activity,
            is_published: true,
            status: 'published',
          },
        ],
        assignments: [
          {
            id: 'assignment-1',
            student_id: 'student-1',
            class_id: null,
            activity_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            version_id: 'version-1',
            game_id: 'legacy-game-1',
          },
        ],
      }),
    );

    const { default: PlayPage } = await import('./page');

    await expect(
      PlayPage({
        params: Promise.resolve({ activityId: ACTIVITY_ID }),
        searchParams: Promise.resolve({ assignmentId: 'assignment-1' }),
      }),
    ).rejects.toThrow('not-found');
  });

  it('does not let students consume preview sessions', async () => {
    createClientMock.mockReturnValue(
      makeSupabase({
        user: { id: 'student-1' },
        profile: { id: 'student-1', role: 'student' },
        activities: [activity],
      }),
    );

    const { default: PlayPage } = await import('./page');

    await expect(
      PlayPage({
        params: Promise.resolve({ activityId: ACTIVITY_ID }),
        searchParams: Promise.resolve({ previewId: 'preview-session-1' }),
      }),
    ).rejects.toThrow('not-found');
  });
});
