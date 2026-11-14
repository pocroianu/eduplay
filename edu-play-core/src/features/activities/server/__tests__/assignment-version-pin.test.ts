import { describe, expect, it, vi } from 'vitest';

import { resolveLatestPublishedActivityAssignmentTarget } from '../assignment-version-pin';

type Row = Record<string, unknown>;

class Query {
  private filters: Array<[string, unknown]> = [];
  private orderColumn: string | null = null;
  private ascending = true;
  private limitCount: number | null = null;

  constructor(private rows: Row[]) {}

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

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    const row = this.execute()[0] ?? null;
    return Promise.resolve({ data: row, error: null });
  }

  private execute() {
    let rows = this.rows.filter((row) =>
      this.filters.every(([column, value]) => row[column] === value),
    );

    if (this.orderColumn) {
      rows = [...rows].sort((left, right) => {
        const a = left[this.orderColumn!];
        const b = right[this.orderColumn!];
        if (a === b) return 0;
        return (a as number) > (b as number)
          ? this.ascending ? 1 : -1
          : this.ascending ? -1 : 1;
      });
    }

    return this.limitCount == null ? rows : rows.slice(0, this.limitCount);
  }
}

function makeSupabase(tables: Record<string, Row[]>) {
  return {
    from: vi.fn((table: string) => new Query(tables[table] ?? [])),
  };
}

describe('resolveLatestPublishedActivityAssignmentTarget', () => {
  it('returns latest version pin for a published Activity', async () => {
    const supabase = makeSupabase({
      activities: [
        {
          id: 'activity-1',
          title: 'Fractions',
          status: 'published',
          is_published: true,
        },
      ],
      activity_versions: [
        { id: 'version-1', activity_id: 'activity-1', version_number: 1 },
        { id: 'version-2', activity_id: 'activity-1', version_number: 2 },
      ],
    });

    await expect(
      resolveLatestPublishedActivityAssignmentTarget(supabase as never, 'activity-1', {
        versionClient: supabase as never,
      }),
    ).resolves.toEqual({
      activityId: 'activity-1',
      versionId: 'version-2',
      title: 'Fractions',
    });
  });

  it('returns null for unpublished Activities', async () => {
    const supabase = makeSupabase({
      activities: [
        {
          id: 'activity-1',
          title: 'Fractions',
          status: 'draft',
          is_published: false,
        },
      ],
    });

    await expect(
      resolveLatestPublishedActivityAssignmentTarget(supabase as never, 'activity-1', {
        versionClient: supabase as never,
      }),
    ).resolves.toBeNull();
  });

  it('authorizes the Activity with the caller client before reading latest versions with a service-role client', async () => {
    const userClient = makeSupabase({
      activities: [
        {
          id: 'activity-1',
          title: 'Privată gata',
          status: 'published',
          is_published: true,
        },
      ],
      activity_versions: [],
    });
    const versionClient = makeSupabase({
      activity_versions: [
        { id: 'private-version-1', activity_id: 'activity-1', version_number: 1 },
      ],
    });

    await expect(
      resolveLatestPublishedActivityAssignmentTarget(userClient as never, 'activity-1', {
        versionClient: versionClient as never,
      }),
    ).resolves.toEqual({
      activityId: 'activity-1',
      versionId: 'private-version-1',
      title: 'Privată gata',
    });

    expect(userClient.from).toHaveBeenCalledWith('activities');
    expect(versionClient.from).toHaveBeenCalledWith('activity_versions');
  });
});
