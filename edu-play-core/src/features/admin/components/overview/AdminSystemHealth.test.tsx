import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminSystemHealth } from "./AdminSystemHealth";

describe("AdminSystemHealth", () => {
  it("labels storage progress and clamps its accessible value", () => {
    render(<AdminSystemHealth storagePercent={120} />);
    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAccessibleName();
    expect(progress).toHaveAttribute("aria-valuenow", "100");
    expect(progress.querySelector(".mantine-Progress-section")).toHaveStyle({
      width: "100%",
    });
  });
});
