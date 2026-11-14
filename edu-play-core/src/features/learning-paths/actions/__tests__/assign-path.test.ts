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

import { assignPath } from "../assign-path";

const PATH_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const ASSIGNMENT_ID = "44444444-4444-4444-8444-444444444444";
const ACTOR_ID = "55555555-5555-4555-8555-555555555555";

const ASSIGNMENT_ROW = {
  id: ASSIGNMENT_ID,
  path_id: PATH_ID,
  class_id: CLASS_ID,
  student_id: null,
  assigned_by: ACTOR_ID,
  due_date: null,
  created_at: "2026-05-01T00:00:00Z",
};

interface InsertCapture {
  table?: string;
  payload?: Record<string, unknown>;
}

interface FakeQuery {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

function fakeAssignSupabase(
  pathRes: FakeQuery,
  insertRes: FakeQuery,
  capture: InsertCapture = {},
) {
  return {
    from: vi.fn((table: string) => {
      if (table === "learning_paths") {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.maybeSingle = vi.fn(() => Promise.resolve(pathRes));
        return builder;
      }
      if (table === "learning_path_assignments") {
        const builder: Record<string, unknown> = {};
        builder.insert = vi.fn((payload: Record<string, unknown>) => {
          capture.table = table;
          capture.payload = payload;
          return builder;
        });
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.maybeSingle = vi.fn(() => Promise.resolve(insertRes));
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

describe("assignPath", () => {
  it("rejects when both class and student are present", async () => {
    const result = await assignPath({
      pathId: PATH_ID,
      classId: CLASS_ID,
      studentId: STUDENT_ID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a draft path with the publish-gate error", async () => {
    const supabase = fakeAssignSupabase(
      {
        data: { status: "draft", owner_kind: "teacher", created_by: ACTOR_ID },
        error: null,
      },
      { data: null, error: null },
    );
    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });
    const result = await assignPath({ pathId: PATH_ID, classId: CLASS_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Parcursul nu este publicat încă");
  });

  it('returns "not found" when the path lookup misses', async () => {
    const supabase = fakeAssignSupabase(
      { data: null, error: null },
      { data: null, error: null },
    );
    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });
    const result = await assignPath({ pathId: PATH_ID, classId: CLASS_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Parcursul nu a fost găsit");
  });

  it("rejects another teacher-owned published path", async () => {
    const supabase = fakeAssignSupabase(
      {
        data: {
          status: "published",
          owner_kind: "teacher",
          created_by: "66666666-6666-4666-8666-666666666666",
        },
        error: null,
      },
      { data: null, error: null },
    );
    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });

    const result = await assignPath({ pathId: PATH_ID, classId: CLASS_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Nu poți atribui acest parcurs");
  });

  it("inserts a class assignment for an owned published path", async () => {
    const capture: InsertCapture = {};
    const supabase = fakeAssignSupabase(
      {
        data: {
          status: "published",
          owner_kind: "teacher",
          created_by: ACTOR_ID,
        },
        error: null,
      },
      { data: ASSIGNMENT_ROW, error: null },
      capture,
    );

    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });

    const result = await assignPath({ pathId: PATH_ID, classId: CLASS_ID });
    expect(result.success).toBe(true);
    expect(capture.payload).toMatchObject({
      path_id: PATH_ID,
      class_id: CLASS_ID,
      student_id: null,
      assigned_by: ACTOR_ID,
    });
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("inserts a class assignment for an admin-published path", async () => {
    const capture: InsertCapture = {};
    const supabase = fakeAssignSupabase(
      {
        data: {
          status: "published",
          owner_kind: "admin",
          created_by: "66666666-6666-4666-8666-666666666666",
        },
        error: null,
      },
      { data: ASSIGNMENT_ROW, error: null },
      capture,
    );

    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });

    const result = await assignPath({ pathId: PATH_ID, classId: CLASS_ID });
    expect(result.success).toBe(true);
    expect(capture.payload?.path_id).toBe(PATH_ID);
  });

  it("returns a friendly DB error on RLS-negative inserts", async () => {
    const supabase = fakeAssignSupabase(
      {
        data: {
          status: "published",
          owner_kind: "teacher",
          created_by: ACTOR_ID,
        },
        error: null,
      },
      { data: null, error: { message: "rls denied" } },
    );

    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });

    const result = await assignPath({ pathId: PATH_ID, classId: CLASS_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Nu am putut atribui parcursul. Încearcă din nou.",
    );
  });

  it("maps database duplicate assignment violations to Romanian copy", async () => {
    const capture: InsertCapture = {};
    const supabase = fakeAssignSupabase(
      {
        data: {
          status: "published",
          owner_kind: "teacher",
          created_by: ACTOR_ID,
        },
        error: null,
      },
      {
        data: null,
        error: {
          code: "23505",
          message:
            "duplicate key value violates unique constraint \"learning_path_assignments_unique_class_target\"",
        },
      },
      capture,
    );

    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });

    const result = await assignPath({ pathId: PATH_ID, classId: CLASS_ID });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Acest parcurs este deja atribuit.");
    expect(capture.payload).toMatchObject({
      path_id: PATH_ID,
      class_id: CLASS_ID,
    });
  });

  it("inserts a student assignment with due date", async () => {
    const capture: InsertCapture = {};
    const supabase = fakeAssignSupabase(
      {
        data: {
          status: "published",
          owner_kind: "teacher",
          created_by: ACTOR_ID,
        },
        error: null,
      },
      {
        data: {
          ...ASSIGNMENT_ROW,
          class_id: null,
          student_id: STUDENT_ID,
          due_date: "2026-06-01",
        },
        error: null,
      },
      capture,
    );

    requireRoleMock.mockResolvedValueOnce({
      user: { id: ACTOR_ID, email: "t@example.com" },
      profile: { id: ACTOR_ID, role: "teacher", full_name: "T" },
      supabase,
    });

    const result = await assignPath({
      pathId: PATH_ID,
      studentId: STUDENT_ID,
      dueDate: "2026-06-01",
    });

    expect(result.success).toBe(true);
    expect(capture.payload).toMatchObject({
      class_id: null,
      student_id: STUDENT_ID,
      due_date: "2026-06-01",
    });
  });
});
