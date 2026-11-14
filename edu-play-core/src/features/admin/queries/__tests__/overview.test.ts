import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getActiveUsers7d,
  getGdprOpenCount,
  getAuditIncidents24h,
  getRecentFlagChanges,
  getPublishedGamesStats,
  getRecentAuditEntries,
  getAdminOverviewSnapshot,
} from '../overview';

type SelectResult = {
  data?: unknown;
  count?: number | null;
  error?: { message: string } | null;
};

interface BuilderConfig {
  result: SelectResult;
}

function makeQueryBuilder({ result }: BuilderConfig) {
  // The chain ends either by being awaited directly (Promise.then handler)
  // or by a terminal call that resolves to the result. Supabase's builder
  // is thenable, so we mirror that.
  const builder: Record<string, unknown> = {};
  const passthrough = ['select', 'eq', 'gte', 'lte', 'not', 'order', 'limit'];
  for (const fn of passthrough) {
    builder[fn] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (
    onFulfilled: (value: SelectResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

interface FakeClientConfig {
  /** Map of `tableName` → ordered list of results for sequential .from() calls. */
  perTable: Record<string, SelectResult[]>;
}

function fakeClient(config: FakeClientConfig) {
  const seen: Record<string, number> = {};
  const fromCalls: string[] = [];
  const from = vi.fn((table: string) => {
    fromCalls.push(table);
    const queue = config.perTable[table];
    if (!queue || queue.length === 0) {
      throw new Error(`fake supabase: no queued result for table=${table}`);
    }
    const idx = seen[table] ?? 0;
    if (idx >= queue.length) {
      throw new Error(`fake supabase: ran out of results for table=${table}`);
    }
    seen[table] = idx + 1;
    return makeQueryBuilder({ result: queue[idx] });
  });
  return { client: { from } as unknown as SupabaseClient, from, fromCalls };
}

const ACTOR_A = '11111111-1111-1111-1111-111111111111';
const ACTOR_B = '22222222-2222-2222-2222-222222222222';

describe('getActiveUsers7d', () => {
  it('counts distinct changed_by actors over the rolling window', async () => {
    const { client } = fakeClient({
      perTable: {
        audit_logs: [
          {
            data: [
              { changed_by: ACTOR_A },
              { changed_by: ACTOR_A },
              { changed_by: ACTOR_B },
              { changed_by: null },
            ],
            error: null,
          },
        ],
      },
    });
    const stat = await getActiveUsers7d(client);
    expect(stat).toEqual({ count: 2, windowDays: 7 });
  });

  it('returns zero when no rows are present', async () => {
    const { client } = fakeClient({
      perTable: { audit_logs: [{ data: [], error: null }] },
    });
    const stat = await getActiveUsers7d(client);
    expect(stat.count).toBe(0);
  });

  it('throws when the underlying query errors', async () => {
    const { client } = fakeClient({
      perTable: {
        audit_logs: [{ data: null, error: { message: 'rls denied' } }],
      },
    });
    await expect(getActiveUsers7d(client)).rejects.toThrow(/rls denied/);
  });
});

describe('getGdprOpenCount', () => {
  it('returns the pending deletion-request count', async () => {
    const { client } = fakeClient({
      perTable: { deletion_requests: [{ count: 5, error: null }] },
    });
    const stat = await getGdprOpenCount(client);
    expect(stat).toEqual({ count: 5 });
  });

  it('treats null count as zero', async () => {
    const { client } = fakeClient({
      perTable: { deletion_requests: [{ count: null, error: null }] },
    });
    const stat = await getGdprOpenCount(client);
    expect(stat.count).toBe(0);
  });
});

describe('getAuditIncidents24h', () => {
  it('returns the admin-action count over the last 24h', async () => {
    const { client } = fakeClient({
      perTable: { audit_logs: [{ count: 3, error: null }] },
    });
    const stat = await getAuditIncidents24h(client);
    expect(stat).toEqual({ count: 3, windowHours: 24 });
  });
});

describe('getRecentFlagChanges', () => {
  it('maps snake_case rows into camelCase events', async () => {
    const occurred = '2026-04-26T12:34:56.000Z';
    const { client } = fakeClient({
      perTable: {
        feature_flag_events: [
          {
            data: [
              {
                flag_name: 'game_builder_beta',
                action: 'enabled',
                actor_id: ACTOR_A,
                created_at: occurred,
              },
              {
                flag_name: 'game_builder_beta',
                action: 'created',
                actor_id: null,
                created_at: occurred,
              },
            ],
            error: null,
          },
        ],
      },
    });
    const events = await getRecentFlagChanges(client);
    expect(events).toEqual([
      {
        flagName: 'game_builder_beta',
        action: 'enabled',
        actorId: ACTOR_A,
        occurredAt: occurred,
      },
      {
        flagName: 'game_builder_beta',
        action: 'created',
        actorId: null,
        occurredAt: occurred,
      },
    ]);
  });

  it('returns an empty list when nothing has changed', async () => {
    const { client } = fakeClient({
      perTable: { feature_flag_events: [{ data: [], error: null }] },
    });
    expect(await getRecentFlagChanges(client)).toEqual([]);
  });
});

describe('getPublishedGamesStats', () => {
  it('returns published vs total Activity counts', async () => {
    const { client } = fakeClient({
      perTable: {
        activities: [
          { count: 12, error: null },
          { count: 7, error: null },
        ],
      },
    });
    const stat = await getPublishedGamesStats(client);
    expect(stat).toEqual({ published: 7, total: 12 });
  });

  it('surfaces the published-side error', async () => {
    const { client } = fakeClient({
      perTable: {
        activities: [
          { count: 12, error: null },
          { count: null, error: { message: 'rls violation' } },
        ],
      },
    });
    await expect(getPublishedGamesStats(client)).rejects.toThrow(/rls violation/);
  });
});

describe('getRecentAuditEntries', () => {
  it('maps snake_case audit rows into camelCase entries', async () => {
    const occurred = '2026-04-28T08:15:00.000Z';
    const { client } = fakeClient({
      perTable: {
        audit_logs: [
          {
            data: [
              {
                id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                changed_by: ACTOR_A,
                action: 'flag_enabled',
                table_name: 'feature_flags',
                record_id: null,
                resource_id_text: 'listen_tap_audio',
                changed_at: occurred,
              },
              {
                id: 7,
                changed_by: null,
                action: null,
                table_name: 'profiles',
                record_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                resource_id_text: null,
                changed_at: occurred,
              },
            ],
            error: null,
          },
        ],
      },
    });

    const entries = await getRecentAuditEntries(client);
    expect(entries).toEqual([
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        actorId: ACTOR_A,
        action: 'flag_enabled',
        resourceType: 'feature_flags',
        resourceId: 'listen_tap_audio',
        occurredAt: occurred,
      },
      {
        id: '7',
        actorId: null,
        action: null,
        resourceType: 'profiles',
        resourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        occurredAt: occurred,
      },
    ]);
  });

  it('returns an empty list when no rows are present', async () => {
    const { client } = fakeClient({
      perTable: { audit_logs: [{ data: [], error: null }] },
    });
    expect(await getRecentAuditEntries(client)).toEqual([]);
  });
});

describe('getAdminOverviewSnapshot', () => {
  it('composes every component query in parallel', async () => {
    const { client, fromCalls } = fakeClient({
      perTable: {
        audit_logs: [
          // active users
          { data: [{ changed_by: ACTOR_A }], error: null },
          // audit incidents
          { count: 4, error: null },
          // recent audit entries
          {
            data: [
              {
                id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                changed_by: ACTOR_A,
                action: 'flag_enabled',
                table_name: 'feature_flags',
                record_id: null,
                resource_id_text: 'listen_tap_audio',
                changed_at: '2026-04-28T08:15:00.000Z',
              },
            ],
            error: null,
          },
        ],
        deletion_requests: [{ count: 1, error: null }],
        feature_flag_events: [
          {
            data: [
              {
                flag_name: 'game_builder_beta',
                action: 'enabled',
                actor_id: null,
                created_at: '2026-04-26T00:00:00.000Z',
              },
            ],
            error: null,
          },
        ],
        activities: [
          { count: 9, error: null },
          { count: 5, error: null },
        ],
      },
    });

    const snapshot = await getAdminOverviewSnapshot(client);

    expect(snapshot.activeUsers).toEqual({ count: 1, windowDays: 7 });
    expect(snapshot.gdprOpen).toEqual({ count: 1 });
    expect(snapshot.auditIncidents).toEqual({ count: 4, windowHours: 24 });
    expect(snapshot.recentFlagChanges).toHaveLength(1);
    expect(snapshot.recentFlagChanges[0].flagName).toBe('game_builder_beta');
    expect(snapshot.publishedGames).toEqual({ published: 5, total: 9 });
    expect(snapshot.recentAuditEntries).toHaveLength(1);
    expect(snapshot.recentAuditEntries[0]).toMatchObject({
      action: 'flag_enabled',
      resourceType: 'feature_flags',
    });

    // Confirms every domain table was hit and `activities` is queried twice.
    expect(fromCalls.filter((t) => t === 'activities')).toHaveLength(2);
    expect(fromCalls.filter((t) => t === 'audit_logs')).toHaveLength(3);
    expect(fromCalls).toEqual(
      expect.arrayContaining([
        'audit_logs',
        'deletion_requests',
        'feature_flag_events',
        'activities',
      ]),
    );
  });
});
