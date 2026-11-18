"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useActivityPlaySession } from '../player/use-activity-play-session';
import { ROUTES } from "@/shared/lib/constants";
import { CategoryBanner } from "./CategoryBanner";
import { GameStage, type GamePhase } from "./GameStage";
import { ExitConfirmDialog } from "./ExitConfirmDialog";
import { useCategoryTheme } from "./getCategoryTheme";
import type { GameCompleteResult } from "@/features/games/types/game.types";

interface GamePageContentProps {
  game: {
    id: string;
    title: string;
    game_url: string | null;
    category: string | null;
    difficulty_level: number | null;
    estimated_duration: number | null;
  };
  progress: {
    score: number | null;
    attempts: number;
  } | null;
  backUrl: string;
  studentId?: string;
  activityId?: string;
  versionId?: string;
  assignmentId?: string;
  configUrl?: string;
  playerName?: string | null;
}

const TOTAL_DOTS = 5;

function subscribeToOnlineStatus(onChange: () => void) {
  window.addEventListener("offline", onChange);
  window.addEventListener("online", onChange);
  return () => {
    window.removeEventListener("offline", onChange);
    window.removeEventListener("online", onChange);
  };
}

const getIsOffline = () => !navigator.onLine;
const getServerIsOffline = () => false;

export function GamePageContent({
  game,
  progress,
  backUrl,
  studentId,
  activityId,
  versionId,
  assignmentId,
  configUrl,
  playerName,
}: GamePageContentProps) {
  const router = useRouter();
  const { t } = useTranslation("player");
  const [result, setResult] = useState<GameCompleteResult | null>(null);
  const [playSession, setPlaySession] = useState(0);
  const session = useActivityPlaySession({ studentId, activityId, versionId, assignmentId }, playSession);
  const saveStatus = useSyncExternalStore(
    session.subscribe,
    () => session.getSnapshot().saveStatus,
    () => session.getSnapshot().saveStatus,
  );
  const [phase, setPhase] = useState<GamePhase>(
    game.game_url ? "intro" : "intro",
  );
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  // Server snapshot is always "online" so SSR and hydration agree (Node >= 21 exposes a
  // `navigator` without `onLine`); the real browser state is read after hydration.
  const isOffline = useSyncExternalStore(subscribeToOnlineStatus, getIsOffline, getServerIsOffline);
  const [loadError, setLoadError] = useState(false);

  const theme = useCategoryTheme(game.category);

  const nextHref = backUrl.startsWith("/student")
    ? ROUTES.STUDENT.ACTIVITIES
    : backUrl.startsWith("/parent")
      ? ROUTES.PARENT.ACTIVITIES
      : backUrl.startsWith("/admin")
        ? ROUTES.ADMIN.CMS_ACTIVITIES
        : ROUTES.TEACHER.ACTIVITIES;

  const displayPlayerName =
    playerName?.trim() || t("activityNavbar.playerFallback");
  const liveScore = result
    ? result.score
    : Math.max(0, Math.min(100, progress?.score ?? 0));
  const filledDots = result
    ? TOTAL_DOTS
    : Math.max(1, Math.min(TOTAL_DOTS, Math.round((liveScore || 15) / 20)));
  const handleStart = useCallback(() => {
    setLoadError(false);
    setPhase("playing");
  }, []);

  const handleComplete = useCallback((completion: GameCompleteResult) => {
    setResult(completion);
    setPhase("complete");
  }, []);

  const handleRetry = useCallback(() => {
    session.exit();
    setResult(null);
    setLoadError(false);
    setPlaySession((n) => n + 1);
    setPhase("playing");
  }, [session]);

  const handleRetryLoad = useCallback(() => {
    session.exit();
    setLoadError(false);
    setPlaySession((n) => n + 1);
  }, [session]);

  const handleLoadError = useCallback(() => {
    session.pause(true);
    setLoadError(true);
  }, [session]);

  const navigateBack = useCallback(() => {
    session.exit();
    router.push(backUrl);
  }, [router, backUrl, session]);

  const handleBackTap = useCallback(() => {
    if ((phase === "playing" && !result) || saveStatus === "saving" || saveStatus === "error") {
      setShowExitConfirm(true);
      return;
    }
    navigateBack();
  }, [phase, result, navigateBack, saveStatus]);

  const handleExitConfirmStay = useCallback(() => {
    setShowExitConfirm(false);
  }, []);

  const handleExitConfirmExit = useCallback(() => {
    setShowExitConfirm(false);
    navigateBack();
  }, [navigateBack]);

  return (
    <main
      aria-label="Activitate de joc"
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background: "var(--color-surface)",
        color: "var(--color-on-surface)",
      }}
    >
      {phase !== "playing" && (
        <CategoryBanner
          theme={theme}
          title={game.title}
          backUrl={backUrl}
          totalDots={TOTAL_DOTS}
          filledDots={filledDots}
          isComplete={result !== null}
          onBack={handleBackTap}
        />
      )}

      <div className="flex-1 flex flex-col gap-3 py-3 min-h-0">
        <GameStage
          session={session}
          saveStatus={saveStatus}
          onRetrySave={session.retrySave}
          theme={theme}
          backUrl={backUrl}
          gameUrl={game.game_url}
          gameTitle={game.title}
          playerName={displayPlayerName}
          difficulty={game.difficulty_level}
          estimatedMinutes={game.estimated_duration}
          studentId={studentId}
          activityId={activityId}
          versionId={versionId}
          assignmentId={assignmentId}
          configUrl={configUrl}
          continueHref={nextHref}
          phase={phase}
          result={result}
          attempts={progress?.attempts ?? 0}
          playSession={playSession}
          isMuted={isMuted}
          isOffline={isOffline}
          loadError={loadError}
          onStart={handleStart}
          onBack={handleBackTap}
          onRetryLoad={handleRetryLoad}
          onRetry={handleRetry}
          onMuteChange={setIsMuted}
          onRequestExit={() => setShowExitConfirm(true)}
          onLoadError={handleLoadError}
          onComplete={handleComplete}
        />
      </div>

      <ExitConfirmDialog
        open={showExitConfirm}
        onStay={handleExitConfirmStay}
        onExit={handleExitConfirmExit}
      />
    </main>
  );
}
