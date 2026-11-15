import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => mocks);
import { advanceProgress } from "../advance-progress";

const input = {
  studentId: "11111111-1111-4111-8111-111111111111",
  pathId: "22222222-2222-4222-8222-222222222222",
  completedStepId: "33333333-3333-4333-8333-333333333331",
};
const rpc = vi.fn();
const maybeSingle = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle,
  };
  mocks.createClient.mockResolvedValue({ from: vi.fn(() => query) });
  mocks.createAdminClient.mockReturnValue({ rpc });
  maybeSingle.mockResolvedValue({
    data: { id: input.completedStepId, path_id: input.pathId, step_order: 1 },
    error: null,
  });
  rpc.mockResolvedValue({ error: null });
});

describe("advanceProgress adapter", () => {
  it("rejects invalid input before reading or writing", async () => {
    await expect(
      advanceProgress({ ...input, studentId: "nope" }),
    ).rejects.toThrow(/elev/);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("checks scoped step access before the trusted atomic transition", async () => {
    await advanceProgress(input);
    expect(rpc).toHaveBeenCalledWith("advance_learning_path_progress", {
      p_student_id: input.studentId,
      p_path_id: input.pathId,
      p_completed_step_id: input.completedStepId,
    });
  });

  it("never performs a privileged write for an invisible step", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(advanceProgress(input)).rejects.toThrow(
      "Pasul finalizat nu aparține parcursului",
    );
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("propagates a failed atomic transition to the completion coordinator", async () => {
    rpc.mockResolvedValue({ error: { message: "transition failed" } });
    await expect(advanceProgress(input)).rejects.toThrow("transition failed");
  });
});
