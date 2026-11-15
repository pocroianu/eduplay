import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LessonDrawer } from "./LessonDrawer";
import type { CategoryTheme } from "./getCategoryTheme";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const theme: CategoryTheme = {
  accentColor: "var(--color-primary)",
  accentSoft: "var(--color-primary-wash)",
  icon: "Sparkle",
  themeKey: "default",
  badge: "Misiune",
  title: "Lecție",
  subtitle: "Descriere",
  quote: "Încearcă",
  steps: ["Unu", "Doi", "Trei"],
  coach: "Sfat",
};

describe("LessonDrawer", () => {
  it("labels the dialog, focuses close, and dismisses with Escape", async () => {
    const onClose = vi.fn();
    render(
      <LessonDrawer theme={theme} open onClose={onClose} helperText="Ajutor" />,
    );
    const dialog = screen.getByRole("dialog", { name: "drawer.title" });
    expect(screen.getByText("Ajutor")).toBeInTheDocument();
    const close = screen.getByRole("button", { name: "drawer.close" });
    await waitFor(() => expect(close).toHaveFocus());
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
