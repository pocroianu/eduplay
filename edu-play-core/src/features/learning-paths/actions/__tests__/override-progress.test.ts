import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.fn();
const revalidatePathMock = vi.fn();
const createAdminClientMock = vi.fn();

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

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

import { overrideProgress } from "../override-progress";
import type { FakeResult, UpsertCapture } from "./test-helpers";

const STUDENT_ID = "11111111-1111-4111-8111-111111111111";
const PATH_ID = "22222222-2222-4222-8222-222222222222";
const STEP_ID = "33333333-3333-4333-8333-333333333333";
const ACTOR_ID = "44444444-4444-4444-8444-444444444444";

const PROGRESS_ROW = {
  id: "pr1",
  student_id: STUDENT_ID,
  path_id: PATH_ID,
  current_step_id: null,
  last_completed_step_id: null,
  status: "completed",
  started_at: "2026-05-01T00:00:00Z",
  completed_at: "2026-05-01T01:00:00Z",
  updated_at: "2026-05-01T01:00:00Z",
};

function fakeOverrideSupabase(
  upsertRes: FakeResult,
  capture: UpsertCapture,
  options: {
    studentRes?: FakeResult;
    assignmentRes?: FakeResult;
  } = {},
) {
  const studentRes = options.studentRes ?? {
    data: { class_id: "99999999-9999-4999-8999-999999999999" },
    error: null,
  };
  const assignmentRes = options.assignmentRes ?? {
    data: [{ id: "assignment-1" }],
    error: null,
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "students") {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.maybeSingle = vi.fn(() => Promise.resolve(studentRes));
        return builder;
      }
      if (table === "learning_path_assignments") {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.or = vi.fn(() => builder);
        builder.limit = vi.fn(() => Promise.resolve(assignmentRes));
        return builder;
      }
      if (table === "student_path_progress") {
        const builder: Record<string, unknown> = {};
        builder.upsert = vi.fn(
          (
            payload: Record<string, unknown>,
            upsertOptions: Record<string, unknown>,
          ) => {
            capture.table = table;
            capture.payload = payload;
            capture.options = upsertOptions;
            return builder;
          },
        );
        builder.select = vi.fn(() => builder);
        builder.maybeSingle = vi.fn(() => Promise.resolve(upsertRes));
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

beforeEach(() => {
  requireRoleMock.mockReset();
  revalidatePathMock.mockReset();
  createAdminClientMock.mockReset();
});

describe("overrideProgress", () => {
  it("sets completed_at on a completed override", async () => {
    const capture: UpsertCapture = {};
    const supabase = fakeOverrideSupabase(
      { data: PROGRESS_ROW, error: null },
      capture,
    );
    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });

    const result = await overrideProgress({
      studentId: STUDENT_ID,
      pathId: PATH_ID,
      status: "completed",
    });

    expect(result.success).toBe(true);
    expect(capture.payload?.status).toBe("completed");
    expect(typeof capture.payload?.completed_at).toBe("string");
    expect(capture.options).toEqual({ onConflict: "student_id,path_id" });
  });

  it("clears completed_at when reopening to in_progress", async () => {
    const capture: UpsertCapture = {};
    const supabase = fakeOverrideSupabase(
      {
        data: { ...PROGRESS_ROW, status: "in_progress", completed_at: null },
        error: null,
      },
      capture,
    );
    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });

    const result = await overrideProgress({
      studentId: STUDENT_ID,
      pathId: PATH_ID,
      status: "in_progress",
      currentStepId: STEP_ID,
    });

    expect(result.success).toBe(true);
    expect(capture.payload?.status).toBe("in_progress");
    expect(capture.payload).toHaveProperty("completed_at", null);
    expect(capture.payload).toHaveProperty("last_completed_step_id", null);
  });

  it("clears completed_at when overriding away from completed", async () => {
    const capture: UpsertCapture = {};
    const supabase = fakeOverrideSupabase(
      {
        data: { ...PROGRESS_ROW, status: "overridden", completed_at: null },
        error: null,
      },
      capture,
    );
    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });

    await overrideProgress({
      studentId: STUDENT_ID,
      pathId: PATH_ID,
      status: "overridden",
    });

    expect(capture.payload).toHaveProperty("completed_at", null);
  });

  it("returns a friendly validation error for invalid input", async () => {
    const result = await overrideProgress({
      studentId: "nope",
      pathId: PATH_ID,
      status: "completed",
    });
    expect(result.success).toBe(false);
  });

  it("returns a friendly DB error on RLS-negative upsert", async () => {
    const supabase = fakeOverrideSupabase(
      { data: null, error: { message: "rls denied" } },
      {},
    );
    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });
    const result = await overrideProgress({
      studentId: STUDENT_ID,
      pathId: PATH_ID,
      status: "completed",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Nu am putut actualiza progresul. Încearcă din nou.",
    );
  });

  it("rejects overrides when the path is not assigned to the student or class", async () => {
    const capture: UpsertCapture = {};
    const supabase = fakeOverrideSupabase(
      { data: PROGRESS_ROW, error: null },
      capture,
      { assignmentRes: { data: [], error: null } },
    );
    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });

    const result = await overrideProgress({
      studentId: STUDENT_ID,
      pathId: PATH_ID,
      status: "completed",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Nu poți actualiza un parcurs neatribuit");
    expect(capture.payload).toBeUndefined();
  });

  it("uses an admin-visible student lookup for admin overrides", async () => {
    const capture: UpsertCapture = {};
    const supabase = fakeOverrideSupabase(
      { data: PROGRESS_ROW, error: null },
      capture,
      { studentRes: { data: null, error: null } },
    );
    const adminSupabase = fakeOverrideSupabase(
      { data: PROGRESS_ROW, error: null },
      {},
      {
        studentRes: {
          data: { class_id: "99999999-9999-4999-8999-999999999999" },
          error: null,
        },
      },
    );
    createAdminClientMock.mockReturnValueOnce(adminSupabase);
    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "admin@example.com" },
      profile: { id: ACTOR_ID, role: "admin", full_name: "A" },
      supabase,
    });

    const result = await overrideProgress({
      studentId: STUDENT_ID,
      pathId: PATH_ID,
      status: "completed",
    });

    expect(result.success).toBe(true);
    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
    expect(capture.payload?.student_id).toBe(STUDENT_ID);
  });
});
