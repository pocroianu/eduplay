import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PasswordStrengthIndicator } from "./password-strength-indicator";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("PasswordStrengthIndicator", () => {
  it("exposes the strength as labelled progress with a descriptive value", () => {
    render(<PasswordStrengthIndicator password="StrongPassword123!" />);
    const progress = screen.getByRole("progressbar", {
      name: "passwordStrength.label",
    });
    expect(progress).toHaveAttribute("aria-valuemax", "100");
    expect(progress.getAttribute("aria-valuetext")).toMatch(
      /^passwordStrength\.score\./,
    );
  });

  it("does not render for an empty password", () => {
    render(<PasswordStrengthIndicator password="" />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
