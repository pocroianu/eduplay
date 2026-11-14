import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fakeClient,
  makeArtifactRow,
} from '@/features/portfolio/queries/__tests__/fake-supabase';
import { getFamilyFeed } from '../get-family-feed';
import {
  decodeFeedCursor,
  encodeFeedCursor,
  formatArtifactFeedId,
  formatMilestoneFeedId,
} from '../cursor';

vi.mock('@/features/parent-portal/server', () => ({
  getLinkedChildren: vi.fn(),
}));

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const CHILD_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CHILD_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STRANGER_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const GAME_1_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const GAME_2_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CLASS_ID = '22222222-2222-4222-8222-222222222222';
const ART_1_ID = '33333333-3333-4333-8333-333333333333';
const ART_2_ID = '44444444-4444-4444-8444-444444444444';
const ART_3_ID = '55555555-5555-4555-8555-555555555555';
const ART_4_ID = '66666666-6666-4666-8666-666666666666';

const validArtifactRow = (overrides: Record<string, unknown>) =>
  makeArtifactRow({
    class_id: CLASS_ID,
    visibility: 'family_visible',
    ...overrides,
  });

const linkedChild = (
  id: string,
  name: string,
  avatarUrl: string | null = null,
) => ({
  id,
  name,
  avatarUrl,
  relationshipType: 'mother',
  linkedAt: '2026-01-01T00:00:00.000Z',
});

const milestoneRow = (overrides: {
  studentId: string;
  gameId: string;
  lastPlayedAt: string;
  studentUsername?: string;
  gameTitle?: string;
  score?: number | null;
}) => ({
  student_id: overrides.studentId,
  activity_id: overrides.gameId,
  legacy_game_id: overrides.gameId,
  score: overrides.score ?? 80,
  last_played_at: overrides.lastPlayedAt,
  students: {
    id: overrides.studentId,
    username: overrides.studentUsername ?? 'kid',
    avatar_url: null,
  },
  activities: {
    id: overrides.gameId,
    title: overrides.gameTitle ?? 'Game',
  },
});

let getLinkedChildrenMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  const mod = await import('@/features/parent-portal/server');
  getLinkedChildrenMock = vi.mocked(mod.getLinkedChildren);
  getLinkedChildrenMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('getFamilyFeed', () => {
  it('returns an empty page when the parent has no linked children (no DB calls)', async () => {
    getLinkedChildrenMock.mockResolvedValue([]);
    const { client, from } = fakeClient({ perTable: {} });

    const result = await getFamilyFeed(client, PARENT_ID);

    expect(result).toEqual({ items: [], nextCursor: null });
    expect(from).not.toHaveBeenCalled();
    expect(getLinkedChildrenMock).toHaveBeenCalledWith(PARENT_ID);
  });

  it('merges artifacts and milestones in timestamp-desc order', async () => {
    getLinkedChildrenMock.mockResolvedValue([
      linkedChild(CHILD_A_ID, 'Ana'),
      linkedChild(CHILD_B_ID, 'Bogdan'),
    ]);
    const { client, fromCalls } = fakeClient({
      perTable: {
        child_artifacts: [
          {
            data: [
              validArtifactRow({
                id: ART_1_ID,
                student_id: CHILD_A_ID,
                title: 'Drawing 1',
                reviewed_at: '2026-04-30T08:00:00.000Z',
              }),
              validArtifactRow({
                id: ART_2_ID,
                student_id: CHILD_B_ID,
                title: 'Drawing 2',
                reviewed_at: '2026-04-29T08:00:00.000Z',
              }),
            ],
            error: null,
          },
        ],
        activity_progress: [
          {
            data: [
              milestoneRow({
                studentId: CHILD_A_ID,
                gameId: GAME_1_ID,
                lastPlayedAt: '2026-05-01T09:00:00.000Z',
                gameTitle: 'Litere',
              }),
              milestoneRow({
                studentId: CHILD_B_ID,
                gameId: GAME_2_ID,
                lastPlayedAt: '2026-04-29T18:00:00.000Z',
                gameTitle: 'Numere',
              }),
            ],
            error: null,
          },
        ],
      },
    });

    const result = await getFamilyFeed(client, PARENT_ID);

    expect(fromCalls.sort()).toEqual(['activity_progress', 'child_artifacts']);
    expect(result.items.map((i) => ({ kind: i.kind, ts: i.timestamp }))).toEqual(
      [
        { kind: 'game_completed', ts: '2026-05-01T09:00:00.000Z' },
        { kind: 'artifact_published', ts: '2026-04-30T08:00:00.000Z' },
        { kind: 'game_completed', ts: '2026-04-29T18:00:00.000Z' },
        { kind: 'artifact_published', ts: '2026-04-29T08:00:00.000Z' },
      ],
    );
    // Page size (4) <= default limit (20) → no next cursor.
    expect(result.nextCursor).toBeNull();
    // Joined name + avatar from getLinkedChildren is preserved on artifact items.
    const artifactItem = result.items.find(
      (i) => i.kind === 'artifact_published',
    )!;
    expect(artifactItem.studentName).toBe('Ana');
  });

  it('narrows to a single child and ignores ids the parent is not linked to', async () => {
    getLinkedChildrenMock.mockResolvedValue([
      linkedChild(CHILD_A_ID, 'Ana'),
      linkedChild(CHILD_B_ID, 'Bogdan'),
    ]);
    const { client, trace } = fakeClient({
      perTable: {
        child_artifacts: [{ data: [], error: null }],
        activity_progress: [{ data: [], error: null }],
      },
    });

    await getFamilyFeed(client, PARENT_ID, { childId: CHILD_A_ID });

    // Both helpers were called with .in('student_id', [CHILD_A_ID]) only.
    const ins = trace.calls.filter((c) => c.fn === 'in');
    expect(ins).toHaveLength(2);
    for (const call of ins) {
      expect(call.args).toEqual(['student_id', [CHILD_A_ID]]);
    }
  });

  it("returns an empty page when childId is not one of the parent's linked children", async () => {
    getLinkedChildrenMock.mockResolvedValue([linkedChild(CHILD_A_ID, 'Ana')]);
    const { client, from } = fakeClient({ perTable: {} });

    const result = await getFamilyFeed(client, PARENT_ID, {
      childId: STRANGER_ID,
    });

    expect(result).toEqual({ items: [], nextCursor: null });
    // Defense in depth: never even issue a Supabase call for an id we
    // cannot prove belongs to this parent.
    expect(from).not.toHaveBeenCalled();
  });

  it('encodes nextCursor as the LAST SHOWN item when the merged set exceeds limit', async () => {
    getLinkedChildrenMock.mockResolvedValue([linkedChild(CHILD_A_ID, 'Ana')]);
    const { client } = fakeClient({
      perTable: {
        child_artifacts: [
          {
            data: [
              validArtifactRow({
                id: ART_3_ID,
                student_id: CHILD_A_ID,
                reviewed_at: '2026-04-01T00:00:00.000Z',
              }),
              validArtifactRow({
                id: ART_4_ID,
                student_id: CHILD_A_ID,
                reviewed_at: '2026-03-01T00:00:00.000Z',
              }),
            ],
            error: null,
          },
        ],
        activity_progress: [
          {
            data: [
              milestoneRow({
                studentId: CHILD_A_ID,
                gameId: GAME_1_ID,
                lastPlayedAt: '2026-05-01T00:00:00.000Z',
              }),
              milestoneRow({
                studentId: CHILD_A_ID,
                gameId: GAME_2_ID,
                lastPlayedAt: '2026-04-15T00:00:00.000Z',
              }),
            ],
            error: null,
          },
        ],
      },
    });

    const result = await getFamilyFeed(client, PARENT_ID, { limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.timestamp)).toEqual([
      '2026-05-01T00:00:00.000Z',
      '2026-04-15T00:00:00.000Z',
    ]);
    // The LAST SHOWN row anchors the cursor — page 2's strict `<` filter
    // can then safely include the next item without skipping it.
    expect(result.nextCursor).not.toBeNull();
    const decoded = decodeFeedCursor(result.nextCursor!);
    expect(decoded).toEqual({
      ts: '2026-04-15T00:00:00.000Z',
      id: formatMilestoneFeedId(CHILD_A_ID, GAME_2_ID),
    });
  });

  it('threads opts.cursor into the artifact side as a strict-less-than tuple .or() filter', async () => {
    getLinkedChildrenMock.mockResolvedValue([linkedChild(CHILD_A_ID, 'Ana')]);
    const cursorAnchor = {
      ts: '2026-04-15T00:00:00.000Z',
      id: formatArtifactFeedId(ART_3_ID),
    };
    const cursor = encodeFeedCursor(cursorAnchor);
    const { client, trace } = fakeClient({
      perTable: {
        child_artifacts: [{ data: [], error: null }],
        activity_progress: [{ data: [], error: null }],
      },
    });

    await getFamilyFeed(client, PARENT_ID, { cursor });

    // Cursor anchor is on the artifact side, so:
    //   - artifact side filters (reviewed_at, id) < (ts, ART_3_ID) via .or()
    //   - milestone side falls back to strict last_played_at < ts (no .or())
    const ors = trace.calls.filter((c) => c.fn === 'or');
    expect(ors).toEqual([
      {
        fn: 'or',
        args: [
          `reviewed_at.lt.${cursorAnchor.ts},and(reviewed_at.eq.${cursorAnchor.ts},id.lt.${ART_3_ID})`,
        ],
      },
    ]);
    const lts = trace.calls.filter((c) => c.fn === 'lt');
    expect(lts).toEqual([
      { fn: 'lt', args: ['last_played_at', cursorAnchor.ts] },
    ]);
  });

  it('threads opts.cursor into the milestone side with a composite (ts, student, game) filter', async () => {
    getLinkedChildrenMock.mockResolvedValue([linkedChild(CHILD_A_ID, 'Ana')]);
    const cursorAnchor = {
      ts: '2026-04-15T00:00:00.000Z',
      id: formatMilestoneFeedId(CHILD_A_ID, GAME_2_ID),
    };
    const cursor = encodeFeedCursor(cursorAnchor);
    const { client, trace } = fakeClient({
      perTable: {
        child_artifacts: [{ data: [], error: null }],
        activity_progress: [{ data: [], error: null }],
      },
    });

    await getFamilyFeed(client, PARENT_ID, { cursor });

    // Cursor anchor is on the milestone side, so:
    //   - milestone side filters (ts, student_id, game_id) < (ts, S, G) via .or()
    //   - artifact side falls back to .lte(reviewed_at, ts) since
    //     "artifact:..." lex-precedes any "milestone:..." at same ts.
    const ors = trace.calls.filter((c) => c.fn === 'or');
    expect(ors).toEqual([
      {
        fn: 'or',
        args: [
          `last_played_at.lt.${cursorAnchor.ts},and(last_played_at.eq.${cursorAnchor.ts},student_id.lt.${CHILD_A_ID}),and(last_played_at.eq.${cursorAnchor.ts},student_id.eq.${CHILD_A_ID},activity_id.lt.${GAME_2_ID})`,
        ],
      },
    ]);
    const ltes = trace.calls.filter((c) => c.fn === 'lte');
    expect(ltes).toEqual([
      { fn: 'lte', args: ['reviewed_at', cursorAnchor.ts] },
    ]);
  });

  it('does not apply any cursor filter when no cursor is supplied', async () => {
    getLinkedChildrenMock.mockResolvedValue([linkedChild(CHILD_A_ID, 'Ana')]);
    const { client, trace } = fakeClient({
      perTable: {
        child_artifacts: [{ data: [], error: null }],
        activity_progress: [{ data: [], error: null }],
      },
    });

    await getFamilyFeed(client, PARENT_ID);

    expect(trace.calls.filter((c) => c.fn === 'lt')).toEqual([]);
    expect(trace.calls.filter((c) => c.fn === 'lte')).toEqual([]);
    expect(trace.calls.filter((c) => c.fn === 'or')).toEqual([]);
  });

  it('falls through to "no cursor" when the supplied cursor is malformed (no 500)', async () => {
    getLinkedChildrenMock.mockResolvedValue([linkedChild(CHILD_A_ID, 'Ana')]);
    const { client, trace } = fakeClient({
      perTable: {
        child_artifacts: [{ data: [], error: null }],
        activity_progress: [{ data: [], error: null }],
      },
    });

    await getFamilyFeed(client, PARENT_ID, { cursor: 'this-is-not-base64url' });

    // Garbled cursor → both sides issue an unfiltered first-page query
    // rather than throwing. The page UI keeps rendering even if a stale
    // bookmark is followed.
    expect(trace.calls.filter((c) => c.fn === 'lt')).toEqual([]);
    expect(trace.calls.filter((c) => c.fn === 'lte')).toEqual([]);
    expect(trace.calls.filter((c) => c.fn === 'or')).toEqual([]);
  });

  it('surfaces both items at a same-timestamp boundary across two pages (EDU-346 collision)', async () => {
    // Two milestones share `last_played_at` exactly. With the legacy
    // strict-`.lt(ts)` cursor, the second one would be silently dropped
    // when crossing the boundary; the composite cursor must keep both.
    getLinkedChildrenMock.mockResolvedValue([linkedChild(CHILD_A_ID, 'Ana')]);
    const TS = '2026-04-15T00:00:00.000Z';
    // (student, game) ids; "milestone:CHILD_A:GAME_2_ID" >
    // "milestone:CHILD_A:GAME_1_ID" lexicographically (G_2 prefix > G_1).
    const milestoneA = milestoneRow({
      studentId: CHILD_A_ID,
      gameId: GAME_2_ID,
      lastPlayedAt: TS,
      gameTitle: 'Game-Bigger-Id',
    });
    const milestoneB = milestoneRow({
      studentId: CHILD_A_ID,
      gameId: GAME_1_ID,
      lastPlayedAt: TS,
      gameTitle: 'Game-Smaller-Id',
    });

    const { client, trace } = fakeClient({
      perTable: {
        // Page 1: both milestones come back in feed-id-DESC order
        // (post-merge, since the helper orders by student_id/game_id DESC).
        // Then Page 2 returns just the lex-smaller one (the cursor's
        // strict `<` filter must include it without re-shipping the page-1
        // row).
        child_artifacts: [
          { data: [], error: null },
          { data: [], error: null },
        ],
        activity_progress: [
          { data: [milestoneA, milestoneB], error: null },
          { data: [milestoneB], error: null },
        ],
      },
    });

    const page1 = await getFamilyFeed(client, PARENT_ID, { limit: 1 });

    // Page 1 shows the lex-greater milestone (GAME_2_ID).
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0].id).toBe(
      formatMilestoneFeedId(CHILD_A_ID, GAME_2_ID),
    );
    expect(page1.items[0].timestamp).toBe(TS);
    expect(page1.nextCursor).not.toBeNull();
    const decoded1 = decodeFeedCursor(page1.nextCursor!);
    expect(decoded1).toEqual({
      ts: TS,
      id: formatMilestoneFeedId(CHILD_A_ID, GAME_2_ID),
    });

    // Round-trip: feed page 1's cursor back in.
    const page2 = await getFamilyFeed(client, PARENT_ID, {
      limit: 1,
      cursor: page1.nextCursor!,
    });

    // The lex-LESSER same-ts milestone now surfaces on page 2 — what the
    // legacy `.lt(last_played_at, TS)` filter would have skipped.
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].id).toBe(
      formatMilestoneFeedId(CHILD_A_ID, GAME_1_ID),
    );
    expect(page2.items[0].timestamp).toBe(TS);

    // Sanity-check the SQL that page 2 emitted: composite OR chain on the
    // milestone side (the boundary anchor lives there).
    const page2Ors = trace.calls
      .filter((c) => c.fn === 'or')
      .map((c) => c.args[0]);
    expect(page2Ors).toContain(
      `last_played_at.lt.${TS},and(last_played_at.eq.${TS},student_id.lt.${CHILD_A_ID}),and(last_played_at.eq.${TS},student_id.eq.${CHILD_A_ID},activity_id.lt.${GAME_2_ID})`,
    );
  });

  it('surfaces both items at a same-timestamp boundary when artifact + milestone collide', async () => {
    // Cross-side collision: an artifact and a milestone share the exact
    // same boundary timestamp. The merge order puts "milestone:..." after
    // "artifact:..." in DESC (since 'm' > 'a'), so the milestone is shown
    // first and the artifact must surface on page 2 — without being
    // double-shown or dropped.
    getLinkedChildrenMock.mockResolvedValue([linkedChild(CHILD_A_ID, 'Ana')]);
    const TS = '2026-04-15T00:00:00.000Z';

    const { client } = fakeClient({
      perTable: {
        // Page 1 fetches both sides; page 2 is the post-cursor fetch.
        child_artifacts: [
          {
            data: [
              validArtifactRow({
                id: ART_3_ID,
                student_id: CHILD_A_ID,
                reviewed_at: TS,
              }),
            ],
            error: null,
          },
          {
            data: [
              validArtifactRow({
                id: ART_3_ID,
                student_id: CHILD_A_ID,
                reviewed_at: TS,
              }),
            ],
            error: null,
          },
        ],
        activity_progress: [
          {
            data: [
              milestoneRow({
                studentId: CHILD_A_ID,
                gameId: GAME_1_ID,
                lastPlayedAt: TS,
              }),
            ],
            error: null,
          },
          { data: [], error: null },
        ],
      },
    });

    const page1 = await getFamilyFeed(client, PARENT_ID, { limit: 1 });
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0].id).toBe(
      formatMilestoneFeedId(CHILD_A_ID, GAME_1_ID),
    );
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await getFamilyFeed(client, PARENT_ID, {
      limit: 1,
      cursor: page1.nextCursor!,
    });
    // The same-ts artifact shows up on page 2 — the legacy .lt(ts) filter
    // would have dropped it.
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].id).toBe(formatArtifactFeedId(ART_3_ID));
    expect(page2.items[0].timestamp).toBe(TS);
  });

  it('keeps `nextCursor` opaque to consumers across a round-trip', async () => {
    getLinkedChildrenMock.mockResolvedValue([linkedChild(CHILD_A_ID, 'Ana')]);
    const { client } = fakeClient({
      perTable: {
        child_artifacts: [{ data: [], error: null }],
        activity_progress: [
          {
            data: [
              milestoneRow({
                studentId: CHILD_A_ID,
                gameId: GAME_1_ID,
                lastPlayedAt: '2026-05-01T00:00:00.000Z',
              }),
              milestoneRow({
                studentId: CHILD_A_ID,
                gameId: GAME_2_ID,
                lastPlayedAt: '2026-04-15T00:00:00.000Z',
              }),
            ],
            error: null,
          },
        ],
      },
    });

    const result = await getFamilyFeed(client, PARENT_ID, { limit: 1 });

    expect(typeof result.nextCursor).toBe('string');
    // Encoded form is base64url and contains neither the timestamp nor
    // the feed id in plain text — consumers have no incentive to crack
    // it open and rebuild it themselves.
    expect(result.nextCursor!).not.toContain('2026-05-01');
    expect(result.nextCursor!).not.toContain('milestone:');
    // But the helper round-trips it cleanly.
    expect(decodeFeedCursor(result.nextCursor!)).toEqual({
      ts: '2026-05-01T00:00:00.000Z',
      id: formatMilestoneFeedId(CHILD_A_ID, GAME_1_ID),
    });
  });
});
