import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/types/database";
import { resolveActivityLaunch } from "../resolve-activity-launch";

type Row = Record<string, unknown>;
function client(store: Record<string, Row[]>) {
  const from = vi.fn((table: string) => {
    let rows = [...(store[table] ?? [])];
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => {
        rows = rows.filter((row) => row[key] === value);
        return query;
      },
      order: () => {
        rows.sort(
          (a, b) => Number(b.version_number) - Number(a.version_number),
        );
        return query;
      },
      limit: (count: number) => {
        rows = rows.slice(0, count);
        return query;
      },
      single: async () => ({ data: rows[0] ?? null, error: null }),
    };
    return query;
  });
  // This fake implements only the resolver's read chains, including filters.
  return { from } as unknown as SupabaseClient<Database>;
}

const activity = {
  id: "activity",
  is_published: true,
  visibility_scope: "public",
  created_by: "teacher",
};
const version = {
  id: "v1",
  activity_id: "activity",
  activity_type_id: "free-response",
  version_number: 1,
  config_data: { prompt: "Old" },
};
const latest = {
  ...version,
  id: "v2",
  version_number: 2,
  config_data: { prompt: "Latest" },
};
const assignment = {
  id: "assignment",
  activity_id: "activity",
  version_id: "v1",
  teacher_id: "teacher",
};

describe("resolveActivityLaunch", () => {
  it("selects the latest authorised snapshot and refuses older unassigned versions", async () => {
    const scoped = client({ activities: [activity] });
    const privileged = () =>
      client({ activities: [activity], activity_versions: [version, latest] });
    await expect(
      resolveActivityLaunch(scoped, privileged, "activity", {
        mode: "published",
      }),
    ).resolves.toMatchObject({ versionId: "v2", config: latest.config_data });
    await expect(
      resolveActivityLaunch(scoped, privileged, "activity", {
        mode: "published",
        versionId: "v1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("allows an older private Assignment pin when its teacher owns the Activity", async () => {
    const scoped = client({ assignments: [assignment] });
    const privileged = () =>
      client({
        activities: [{ ...activity, visibility_scope: "private" }],
        activity_versions: [version, latest],
      });
    await expect(
      resolveActivityLaunch(scoped, privileged, "activity", {
        mode: "published",
        assignmentId: "assignment",
      }),
    ).resolves.toMatchObject({ versionId: "v1", config: version.config_data });
  });

  it.each([
    { activity_id: "other" },
    { version_id: null },
    { version_id: "v2" },
  ])(
    "rejects mismatched Assignment identity before privileged reads: %j",
    async (overrides) => {
      const privileged = vi.fn();
      await expect(
        resolveActivityLaunch(
          client({ assignments: [{ ...assignment, ...overrides }] }),
          privileged,
          "activity",
          {
            mode: "published",
            assignmentId: "assignment",
            versionId: "v1",
          },
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(privileged).not.toHaveBeenCalled();
    },
  );

  it("never acquires a privileged client for a hidden Activity or Assignment", async () => {
    const privileged = vi.fn();
    for (const selection of [
      { mode: "published" as const },
      { mode: "published" as const, assignmentId: "hidden" },
    ]) {
      await expect(
        resolveActivityLaunch(client({}), privileged, "activity", selection),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(privileged).not.toHaveBeenCalled();
  });

  it.each([
    { activity: { ...activity, is_published: false }, versions: [version] },
    {
      activity: {
        ...activity,
        visibility_scope: "private",
        created_by: "other",
      },
      versions: [version],
    },
    { activity, versions: [{ ...version, activity_id: "other" }] },
  ])(
    "rejects unpublished, foreign-author or wrong-Activity snapshots: %j",
    async (data) => {
      await expect(
        resolveActivityLaunch(
          client({ assignments: [assignment] }),
          () =>
            client({
              activities: [data.activity],
              activity_versions: data.versions,
            }),
          "activity",
          {
            mode: "published",
            assignmentId: "assignment",
          },
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    },
  );

  const preview = {
    id: "preview",
    activity_id: "activity",
    type_id: "free-response",
    config_data: { prompt: "Draft" },
    created_by: "teacher",
    expires_at: "2999-01-01T00:00:00Z",
  };
  it("selects an owned preview without published or privileged reads", async () => {
    const privileged = vi.fn();
    const scoped = client({
      activities: [{ ...activity, is_published: false }],
      activity_preview_sessions: [preview],
    });
    await expect(
      resolveActivityLaunch(scoped, privileged, "activity", {
        mode: "preview",
        previewId: "preview",
        actorId: "teacher",
        role: "teacher",
      }),
    ).resolves.toMatchObject({ versionId: null, config: preview.config_data });
    expect(privileged).not.toHaveBeenCalled();
  });

  it.each([
    { actorId: "other", role: "teacher", expires_at: preview.expires_at },
    { actorId: "teacher", role: "student", expires_at: preview.expires_at },
    { actorId: "teacher", role: "teacher", expires_at: "2000-01-01T00:00:00Z" },
  ])(
    "rejects foreign, student and expired previews: %j",
    async ({ actorId, role, expires_at }) => {
      const privileged = vi.fn();
      await expect(
        resolveActivityLaunch(
          client({ activity_preview_sessions: [{ ...preview, expires_at }] }),
          privileged,
          "activity",
          {
            mode: "preview",
            previewId: "preview",
            actorId,
            role,
          },
        ),
      ).rejects.toBeDefined();
      expect(privileged).not.toHaveBeenCalled();
    },
  );
});
