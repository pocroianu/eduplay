import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    requireRole: (...args: unknown[]) => requireRoleMock(...args),
  };
});

import { publishPath } from "../publish-path";
import type { InsertCapture } from "./test-helpers";

const PATH_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";

const PUBLISHED_ROW = {
  id: PATH_ID,
  title: "Aventura",
  description: null,
  age_min: null,
  age_max: null,
  status: "published",
  owner_kind: "teacher",
  created_by: ACTOR_ID,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

function fakePublishSupabase(
  options: {
    stepsRes: { data?: unknown; error?: { message: string } | null };
    updateRes: { data?: unknown; error?: { message: string } | null };
  },
  capture: InsertCapture = {},
) {
  return {
    from: vi.fn((table: string) => {
      if (table === "learning_path_steps") {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.limit = vi.fn(() => Promise.resolve(options.stepsRes));
        return builder;
      }
      if (table === "learning_paths") {
        const builder: Record<string, unknown> = {};
        builder.update = vi.fn((payload: Record<string, unknown>) => {
          capture.table = table;
          capture.payload = payload;
          return builder;
        });
        builder.eq = vi.fn((column: string, value: unknown) => {
          capture.filters = [...(capture.filters ?? []), [column, value]];
          return builder;
        });
        builder.select = vi.fn(() => builder);
        builder.maybeSingle = vi.fn(() => Promise.resolve(options.updateRes));
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

beforeEach(() => {
  requireRoleMock.mockReset();
  revalidatePathMock.mockReset();
});

describe("publishPath", () => {
  it("rejects a non-uuid path id", async () => {
    const result = await publishPath({ pathId: "nope" });
    expect(result.success).toBe(false);
  });

  it("flips the path to published on the happy path", async () => {
    const capture: InsertCapture = {};
    const supabase = fakePublishSupabase(
      {
        stepsRes: { data: [{ id: "step-1" }], error: null },
        updateRes: { data: PUBLISHED_ROW, error: null },
      },
      capture,
    );

    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });

    const result = await publishPath({ pathId: PATH_ID });
    expect(result.success).toBe(true);
    expect(result.data?.path.status).toBe("published");
    expect(capture.payload).toEqual({ status: "published" });
    expect(capture.filters).toContainEqual(["id", PATH_ID]);
    expect(capture.filters).toContainEqual(["status", "draft"]);
  });

  it("rejects publishing a draft path with no steps", async () => {
    const capture: InsertCapture = {};
    const supabase = fakePublishSupabase(
      {
        stepsRes: { data: [], error: null },
        updateRes: { data: PUBLISHED_ROW, error: null },
      },
      capture,
    );

    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });

    const result = await publishPath({ pathId: PATH_ID });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Adaugă cel puțin un pas înainte să publici parcursul",
    );
    expect(capture.payload).toBeUndefined();
  });

  it("does not publish when the path is invisible or not draft", async () => {
    const capture: InsertCapture = {};
    const supabase = fakePublishSupabase(
      {
        stepsRes: { data: [{ id: "step-1" }], error: null },
        updateRes: { data: null, error: null },
      },
      capture,
    );

    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });

    const result = await publishPath({ pathId: PATH_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Parcursul nu a fost găsit sau nu mai este în lucru",
    );
    expect(capture.filters).toContainEqual(["status", "draft"]);
  });
});
