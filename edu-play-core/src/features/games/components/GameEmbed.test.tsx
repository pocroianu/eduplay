import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordActivityArtifact } from "@/features/portfolio";
import { GameEmbed } from "./GameEmbed";

vi.mock("@/features/portfolio", () => ({
  recordActivityArtifact: vi.fn(),
}));

describe("GameEmbed host controls", () => {
  let postMessage: ReturnType<typeof vi.fn>;

  function renderWithProviders(ui: ReactElement) {
    return render(<MantineProvider>{ui}</MantineProvider>);
  }

  beforeEach(() => {
    postMessage = vi.fn();
    vi.spyOn(
      HTMLIFrameElement.prototype,
      "contentWindow",
      "get",
    ).mockReturnValue({
      postMessage,
    } as unknown as Window);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderReadyGame(capabilities: { repeatInstruction?: boolean } = {}) {
    const view = renderWithProviders(
      <GameEmbed
        gameUrl="/games/demo/index.html"
        playerName="Ana"
        isMuted={false}
      />,
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: {
          type: "ACTIVITY_READY",
          capabilities,
        },
      }),
    );

    return view;
  }

  function renderCompletableGame(onComplete = vi.fn()) {
    renderWithProviders(
      <GameEmbed
        gameUrl="/games/demo/index.html"
        playerName="Ana"
        isMuted={false}
        onComplete={onComplete}
      />,
    );

    return onComplete;
  }

  it('limits iframe permissions while retaining the origin required by the protocol', () => {
    const { container } = renderReadyGame();
    expect(container.querySelector('iframe')).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin');
    expect(container.querySelector('iframe')).toHaveAttribute('allow', 'autoplay; fullscreen');
  });

  it("normalizes missing star rating from schema-valid game completion", async () => {
    const onComplete = renderCompletableGame();

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: {
          type: "GAME_COMPLETE",
          score: 80,
          totalSets: 10,
          timeSpent: 0,
          reason: "completed",
        },
      }),
    );

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({
        score: 80,
        timeSpent: 0,
        starRating: 2,
        totalSets: 10,
      });
    });
  });

  it("completes progress when optional screenshot data is not a PNG artifact", async () => {
    const onComplete = vi.fn();

    renderWithProviders(
      <GameEmbed
        gameUrl="/games/demo/index.html"
        playerName="Ana"
        isMuted={false}
        studentId="student-1"
        activityId="activity-1"
        onComplete={onComplete}
      />,
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: {
          type: "GAME_COMPLETE",
          score: 90,
          totalSets: 10,
          timeSpent: 0,
          reason: "completed",
          screenshotDataUrl: "data:image/jpeg;base64,aGVsbG8=",
        },
      }),
    );

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({
        score: 90,
        timeSpent: 0,
        starRating: 3,
        totalSets: 10,
      });
    });
    expect(recordActivityArtifact).not.toHaveBeenCalled();
  });

  it("ignores malformed current protocol messages from the trusted origin", async () => {
    const onComplete = renderCompletableGame();

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: {
          type: "ACTIVITY_READY",
          capabilities: { repeatInstruction: "yes" },
        },
      }),
    );

    expect(
      screen.queryByRole("button", { name: "Pune pe pauză" }),
    ).not.toBeInTheDocument();

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: {
          type: "GAME_COMPLETE",
          score: 80,
          totalSets: 10,
          timeSpent: -1,
          reason: "completed",
        },
      }),
    );

    await waitFor(() => {
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  it("ignores schema-valid current protocol messages from the wrong origin", async () => {
    const onComplete = renderCompletableGame();

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://attacker.example.test",
        data: {
          type: "GAME_COMPLETE",
          score: 100,
          totalSets: 10,
          timeSpent: 20,
          reason: "completed",
        },
      }),
    );

    await waitFor(() => {
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  it("sends pause and resume controls through the iframe bridge", async () => {
    renderReadyGame();

    fireEvent.click(
      await screen.findByRole("button", { name: "Pune pe pauză" }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      { type: "GAME_CONTROL", action: "pause" },
      window.location.origin,
    );
    const pauseOverlay = screen.getByRole("status", {
      name: "Jocul este pe pauză",
    });
    expect(pauseOverlay).toBeInTheDocument();

    fireEvent.click(
      within(pauseOverlay).getByRole("button", { name: "Continuă jocul" }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      { type: "GAME_CONTROL", action: "resume" },
      window.location.origin,
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("status", { name: "Jocul este pe pauză" }),
      ).not.toBeInTheDocument();
    });
  });

  it("renders pause overlay chrome without black ink borders", async () => {
    const { container } = renderReadyGame();

    fireEvent.click(
      await screen.findByRole("button", { name: "Pune pe pauză" }),
    );

    const pauseOverlay = screen.getByRole("status", {
      name: "Jocul este pe pauză",
    });
    expect(pauseOverlay).toBeInTheDocument();
    expect(container.querySelector(".border-ink")).toBeNull();
    expect(container.querySelector(".shadow-chunk-lg")).toBeNull();
  });

  it("gates repeat instruction by Activity capability", async () => {
    renderReadyGame({ repeatInstruction: true });

    fireEvent.click(
      await screen.findByRole("button", { name: "Repetă instrucțiunea" }),
    );

    expect(postMessage).toHaveBeenCalledWith(
      { type: "GAME_CONTROL", action: "repeatInstruction" },
      window.location.origin,
    );
  });

  it("keeps repeat visible but disabled when Activity does not support it", async () => {
    renderReadyGame();

    const repeat = await screen.findByRole("button", {
      name: "Repetarea nu este disponibilă",
    });
    fireEvent.click(repeat);

    expect(repeat).toBeDisabled();
    expect(postMessage).not.toHaveBeenCalledWith(
      { type: "GAME_CONTROL", action: "repeatInstruction" },
      expect.any(String),
    );
  });

  it("uses parent remount restart and clears the host pause state", async () => {
    const onRestart = vi.fn();
    renderWithProviders(
      <GameEmbed
        gameUrl="/games/demo/index.html"
        playerName="Ana"
        isMuted={false}
        onRestart={onRestart}
      />,
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: { type: "ACTIVITY_READY" },
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Pune pe pauză" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reîncepe" }));

    expect(onRestart).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.queryByRole("status", { name: "Jocul este pe pauză" }),
      ).not.toBeInTheDocument();
    });
  });
});
