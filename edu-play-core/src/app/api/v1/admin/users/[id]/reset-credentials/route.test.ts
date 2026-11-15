import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  audit: vi.fn(),
  update: vi.fn(),
  signIn: vi.fn(),
  resetEmail: vi.fn(),
  checkLimit: vi.fn(),
  clearAttempts: vi.fn(),
  failedLogin: vi.fn(),
}));
vi.mock("@/lib/api", async () => ({
  ...(await vi.importActual<typeof import("@/lib/api")>("@/lib/api")),
  requireRole: mocks.requireRole,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/admin/audit", () => ({ recordAdminAction: mocks.audit }));
vi.mock("@/features/auth/utils/login-rate-limit", () => ({
  checkLoginRateLimit: mocks.checkLimit,
  clearLoginAttempts: mocks.clearAttempts,
  recordFailedLogin: mocks.failedLogin,
}));

import { POST } from "./route";
import { studentLogin } from "@/features/auth/actions/student-login";
import { ApiError } from "@/lib/api";

const userId = "11111111-1111-4111-8111-111111111111";
const profile = {
  id: userId,
  role: "student",
  email: "learner@student.eduplay.ro",
};
const request = () =>
  POST(
    new Request("http://localhost/api/v1/admin/users/reset-credentials", {
      method: "POST",
    }),
    {
      params: Promise.resolve({ id: userId }),
    },
  );

beforeEach(() => {
  vi.resetAllMocks();
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: profile, error: null }),
    single: async () => ({ data: profile, error: null }),
  };
  mocks.requireRole.mockResolvedValue({
    user: { id: "admin" },
    supabase: { from: () => query },
  });
  mocks.createAdminClient.mockReturnValue({
    auth: {
      admin: { updateUserById: mocks.update },
      resetPasswordForEmail: mocks.resetEmail,
    },
  });
  mocks.update.mockResolvedValue({ error: null });
  mocks.createClient.mockResolvedValue({
    auth: { signInWithPassword: mocks.signIn },
    from: () => query,
  });
  mocks.checkLimit.mockResolvedValue({ allowed: true });
});

describe("admin credential reset", () => {
  it("returns a PIN that signs in through the real student login action", async () => {
    let storedPassword: string | undefined;
    mocks.update.mockImplementation(
      async (_id: string, credential: { password: string }) => {
        storedPassword = credential.password;
        return { error: null };
      },
    );
    mocks.signIn.mockImplementation(
      async ({ password }: { password: string }) => ({
        error:
          password === storedPassword
            ? null
            : { message: "invalid credentials" },
        data: { user: { id: userId } },
      }),
    );
    const response = await request();
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toMatchObject({
      channel: "pin",
      pin: expect.stringMatching(/^\d{4}$/),
    });
    const form = new FormData();
    form.set("username", "learner");
    form.set("pin", data.pin);
    await expect(studentLogin(form)).resolves.toMatchObject({ ok: true });
    expect(mocks.checkLimit).toHaveBeenCalledWith("student:learner");
    expect(mocks.clearAttempts).toHaveBeenCalledWith("student:learner");
    expect(mocks.audit).toHaveBeenCalledExactlyOnceWith({
      actorId: "admin",
      action: "student_pin_reset",
      resourceType: "profiles",
      resourceId: userId,
      before: null,
      after: { rotated: true },
    });
  });

  it("does not return a PIN or record success when Auth rejects the reset", async () => {
    mocks.update.mockResolvedValue({ error: { message: "reset failed" } });
    const response = await request();
    expect(response.status).toBe(500);
    expect((await response.json()).data).toBeNull();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("requires admin access before resetting credentials", async () => {
    mocks.requireRole.mockRejectedValue(ApiError.forbidden());
    expect((await request()).status).toBe(403);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
