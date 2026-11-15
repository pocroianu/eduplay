import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PathAssignmentDialog } from "./PathAssignmentDialog";
import { assignPath } from "../actions";

vi.mock("../actions", () => ({
  assignPath: vi.fn().mockResolvedValue({ success: true }),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function installResizeObserverMock() {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: ResizeObserverMock,
  });
  Element.prototype.scrollIntoView = () => {};
}

const classes = [
  { id: "class-1", name: "Clasa 1A" },
  { id: "class-2", name: "Clasa 1B" },
];

const students = [
  {
    id: "student-1",
    username: "ana.pop",
    fullName: "Ana Pop",
    classId: "class-1",
  },
];

function renderDialog() {
  return render(
    <MantineProvider env="test">
      <PathAssignmentDialog
        pathId="path-1"
        pathTitle="Litera A"
        classes={classes}
        students={students}
      />
    </MantineProvider>,
  );
}

describe("<PathAssignmentDialog />", () => {
  beforeEach(() => {
    installResizeObserverMock();
    vi.mocked(assignPath).mockResolvedValue({ success: false, error: 'Atribuirea nu este disponibilă.' });
  });

  it("renders assignment fields as Mantine controls", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("learning-path-assign"));
    await user.click(await screen.findByRole("radio", { name: "Elev" }));

    expect(screen.getByLabelText("Închide dialogul")).toHaveClass(
      "mantine-CloseButton-root",
    );
    expect(screen.getByTestId("learning-path-assign-target-type")).toHaveClass(
      "mantine-SegmentedControl-root",
    );
    expect(screen.getByRole("combobox", { name: /clasă/i })).toHaveClass(
      "mantine-Select-input",
    );
    expect(screen.getByRole("combobox", { name: /elev/i })).toHaveClass(
      "mantine-Select-input",
    );
    expect(screen.getByLabelText("Dată scadentă")).toHaveClass(
      "mantine-TextInput-input",
    );
  });

  it("keeps the dialog shell free of raw JSX buttons", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/features/learning-paths/components/PathAssignmentDialog.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("CloseButton");
    expect(source).toContain("SegmentedControl");
    expect(source).not.toContain("<button");
  });

  it("labels the modal, returns focus on Escape, and submits the selected class", async () => {
    const user = userEvent.setup();
    renderDialog();
    const trigger = screen.getByTestId("learning-path-assign");
    await user.click(trigger);
    expect(
      await screen.findByRole("dialog", { name: "Atribuie parcursul" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    await waitFor(() => expect(screen.getByLabelText("Închide dialogul")).toHaveFocus());
    await user.click(await screen.findByRole("combobox", { name: /clasă/i }));
    await user.click(await screen.findByRole("option", { name: "Clasa 1A" }));
    await user.click(screen.getByTestId("learning-path-assign-submit"));
    await waitFor(() =>
      expect(assignPath).toHaveBeenCalledWith({
        pathId: "path-1",
        classId: "class-1",
        studentId: undefined,
        dueDate: undefined,
      }),
    );
    expect(await screen.findByText('Atribuirea nu este disponibilă.')).toBeVisible();
  });
});
