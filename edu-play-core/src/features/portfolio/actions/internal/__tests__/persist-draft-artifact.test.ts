import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { persistDraftArtifact } from "../persist-draft-artifact";

const mocks = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ remove: mocks.remove }) },
  }),
}));

const upload = vi.fn();
const insert = vi.fn();
const maybeSingle = vi.fn();
const from = vi.fn(() => ({ insert }));
// The recording interface only needs Storage upload and an artifact insert.
const supabase = {
  storage: { from: vi.fn(() => ({ upload })) },
  from,
} as unknown as SupabaseClient;
const input = {
  studentId: "student",
  classId: "class",
  bytes: new Uint8Array([1, 2]),
  contentType: "audio/ogg",
  extension: "ogg",
  artifactType: "audio" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  upload.mockResolvedValue({ error: null });
  insert.mockReturnValue({ select: () => ({ maybeSingle }) });
  maybeSingle.mockImplementation(async () => ({
    data: { id: insert.mock.calls[0][0].id },
    error: null,
  }));
  mocks.remove.mockResolvedValue({ error: null });
});

describe("persistDraftArtifact", () => {
  it("uploads first with a stable student-prefixed key and inserts one draft", async () => {
    const result = await persistDraftArtifact(supabase, {
      ...input,
      title: "Title",
      metadata: { sourceRef: "activity" },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const key = `student/${result.artifactId}.ogg`;
    expect(upload).toHaveBeenCalledWith(key, input.bytes, {
      contentType: "audio/ogg",
      cacheControl: "3600",
      upsert: false,
    });
    expect(insert).toHaveBeenCalledWith({
      id: result.artifactId,
      student_id: "student",
      class_id: "class",
      artifact_type: "audio",
      storage_path: key,
      visibility: "draft",
      title: "Title",
      metadata: { sourceRef: "activity" },
    });
    expect(upload.mock.invocationCallOrder[0]).toBeLessThan(
      insert.mock.invocationCallOrder[0],
    );
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("skips insertion and compensation after upload rejection", async () => {
    upload.mockResolvedValue({ error: { message: "denied" } });
    await expect(persistDraftArtifact(supabase, input)).resolves.toEqual({
      success: false,
      stage: "upload",
    });
    expect(from).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: { message: "denied" } },
    { data: null, error: null },
  ])(
    "compensates only the uploaded key after an unsuccessful insert: %j",
    async (response) => {
      maybeSingle.mockResolvedValue(response);
      await expect(persistDraftArtifact(supabase, input)).resolves.toEqual({
        success: false,
        stage: "insert",
      });
      expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([
        upload.mock.calls[0][0],
      ]);
    },
  );

  it.each(["throw", "error"])(
    "preserves the insert failure when cleanup fails with %s",
    async (mode) => {
      maybeSingle.mockResolvedValue({
        data: null,
        error: { message: "insert failed" },
      });
      if (mode === "throw")
        mocks.remove.mockRejectedValue(new Error("cleanup failed"));
      else
        mocks.remove.mockResolvedValue({
          error: { message: "cleanup failed" },
        });
      await expect(persistDraftArtifact(supabase, input)).resolves.toEqual({
        success: false,
        stage: "insert",
      });
    },
  );
});
