import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClientMock(),
}));

import { getRecentActivity } from '../get-recent-activity';

const PARENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STUDENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

interface BuilderConfig {
  parentChildren: { data: unknown; error: unknown };
  gameProgress: { data: unknown; error: unknown };
  childArtifacts: { data: unknown; error: unknown };
}

function buildClient(config: BuilderConfig) {
  const storageBuilder = {
    createSignedUrl: vi.fn(async () => ({
      data: { signedUrl: 'https://signed.test/thumb.png' },
      error: null,
    })),
  };
  return {
    from: vi.fn((table: string) => {
      const builder: Record<string, unknown> = {};
      const result =
        table === 'parent_children'
          ? config.parentChildren
          : table === 'activity_progress'
            ? config.gameProgress
            : table === 'child_artifacts'
              ? config.childArtifacts
              : { data: [], error: null };

      builder.select = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.in = vi.fn(() => builder);
      builder.not = vi.fn(() => builder);
      builder.order = vi.fn(() => builder);
      // limit() is the terminal call — resolve here
      builder.limit = vi.fn(() => Promise.resolve(result));
      // Some queries terminate on .eq() chains (parent_children only filters)
      // — emulate the awaited resolution there too.
      builder.then = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled);
      return builder;
    }),
    storage: {
      from: vi.fn(() => storageBuilder),
    },
  };
}

beforeEach(() => {
  createClientMock.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getRecentActivity', () => {
  it('returns an empty list when the parent has no linked children', async () => {
    createClientMock.mockResolvedValue(
      buildClient({
        parentChildren: { data: [], error: null },
        gameProgress: { data: [], error: null },
        childArtifacts: { data: [], error: null },
      }),
    );

    const out = await getRecentActivity(PARENT_ID, 10);
    expect(out).toEqual([]);
  });

  it('interleaves game progress and artifact entries by timestamp desc', async () => {
    createClientMock.mockResolvedValue(
      buildClient({
        parentChildren: {
          data: [
            {
              student_id: STUDENT_ID,
              students: {
                id: STUDENT_ID,
                username: 'Maria',
                avatar_url: null,
              },
            },
          ],
          error: null,
        },
        gameProgress: {
          data: [
            {
              student_id: STUDENT_ID,
              activity_id: '11111111-1111-4111-8111-111111111111',
              score: 90,
              status: 'completed',
              last_played_at: '2026-05-01T08:00:00Z',
              activities: { id: '11111111-1111-4111-8111-111111111111', title: 'Joc Vechi', category: null },
            },
          ],
          error: null,
        },
        childArtifacts: {
          data: [
            {
              id: 'a1',
              student_id: STUDENT_ID,
              title: 'Casa mea',
              artifact_type: 'drawing',
              storage_path: 'p/a1.png',
              reviewed_at: '2026-05-02T10:00:00Z',
            },
          ],
          error: null,
        },
      }),
    );

    const out = await getRecentActivity(PARENT_ID, 10);

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      kind: 'artifact',
      artifactId: 'a1',
      artifactTitle: 'Casa mea',
      timestamp: '2026-05-02T10:00:00Z',
      studentName: 'Maria',
      thumbnailUrl: 'https://signed.test/thumb.png',
    });
    expect(out[1]).toMatchObject({
      kind: 'activity_progress',
      gameId: '11111111-1111-4111-8111-111111111111',
      timestamp: '2026-05-01T08:00:00Z',
    });
  });

  it('caps the merged list to the requested limit', async () => {
    const progressRows = Array.from({ length: 8 }).map((_, i) => ({
      student_id: STUDENT_ID,
      activity_id: `11111111-1111-4111-8111-11111111111${i}`,
      score: 80,
      status: 'completed',
      last_played_at: `2026-04-${String(20 + i).padStart(2, '0')}T08:00:00Z`,
      activities: { id: `11111111-1111-4111-8111-11111111111${i}`, title: `Joc ${i}`, category: null },
    }));
    const artifactRows = Array.from({ length: 8 }).map((_, i) => ({
      id: `a${i}`,
      student_id: STUDENT_ID,
      title: `Lucrare ${i}`,
      artifact_type: 'drawing',
      storage_path: `p/a${i}.png`,
      reviewed_at: `2026-05-${String(1 + i).padStart(2, '0')}T08:00:00Z`,
    }));

    createClientMock.mockResolvedValue(
      buildClient({
        parentChildren: {
          data: [
            {
              student_id: STUDENT_ID,
              students: {
                id: STUDENT_ID,
                username: 'Maria',
                avatar_url: null,
              },
            },
          ],
          error: null,
        },
        gameProgress: { data: progressRows, error: null },
        childArtifacts: { data: artifactRows, error: null },
      }),
    );

    const out = await getRecentActivity(PARENT_ID, 10);
    expect(out).toHaveLength(10);
    // Newest first
    expect(out[0]?.timestamp).toBe('2026-05-08T08:00:00Z');
  });
});

it('keeps the selected child history when a sibling has more than twenty newer entries', async () => {
  const sibling = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const links = [STUDENT_ID, sibling].map((id) => ({
    parent_id: PARENT_ID, student_id: id, status: 'active',
    students: { id, username: id, avatar_url: null },
  }));
  const olderChildEntry = { student_id: STUDENT_ID, activity_id: 'child-activity', score: 80, status: 'completed', last_played_at: '2026-11-01', activities: { id: 'child-activity', title: 'Child history', category: 'math' } };
  const progress = [
    ...Array.from({ length: 21 }, (_, index) => ({ ...olderChildEntry, student_id: sibling, activity_id: `sibling-${index}`, last_played_at: '2026-11-15' })),
    olderChildEntry,
  ];
  createClientMock.mockResolvedValue({
    from(table: string) {
      let rows: Array<Record<string, unknown>> = table === 'parent_children' ? [...links] : table === 'activity_progress' ? [...progress] : [];
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) { rows = rows.filter((row) => row[column] === value); return query; },
        in(column: string, values: unknown[]) { rows = rows.filter((row) => values.includes(row[column])); return query; },
        not() { return query; },
        order() { return query; },
        limit(count: number) { return Promise.resolve({ data: rows.slice(0, count), error: null }); },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
      };
      return query;
    },
  });
  const result = await getRecentActivity(PARENT_ID, 20, STUDENT_ID);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ studentId: STUDENT_ID, gameTitle: 'Child history' });
});
