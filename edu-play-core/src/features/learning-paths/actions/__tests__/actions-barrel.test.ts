import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("learning-paths actions barrel", () => {
  it("keeps the server-only advanceProgress stub out of the shared actions barrel", () => {
    const barrel = readFileSync(
      join(process.cwd(), "src/features/learning-paths/actions/index.ts"),
      "utf8",
    );

    expect(barrel).not.toContain("advance-progress");
    expect(barrel).not.toContain("advanceProgress");
  });
});
