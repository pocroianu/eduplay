"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
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
  const [phase, setPhase] = useState<GamePhase>(
    game.game_url ? "intro" : "intro",
  );
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
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
  // Track browser online/offline state. Initial value comes from the lazy
  // useState initializer above; this effect only syncs subsequent transitions.
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const handleStart = useCallback(() => {
    setLoadError(false);
    setPhase("playing");
  }, []);

  const handleComplete = useCallback((completion: GameCompleteResult) => {
    setResult(completion);
    setPhase("complete");
  }, []);

  const handleRetry = useCallback(() => {
    setResult(null);
    setLoadError(false);
    setPlaySession((n) => n + 1);
    setPhase("playing");
  }, []);

  const handleRetryLoad = useCallback(() => {
    setLoadError(false);
    setPlaySession((n) => n + 1);
  }, []);

  const handleLoadError = useCallback(() => {
    setLoadError(true);
  }, []);

  const navigateBack = useCallback(() => {
    router.push(backUrl);
  }, [router, backUrl]);

  const handleBackTap = useCallback(() => {
    if (phase === "playing" && !result) {
      setShowExitConfirm(true);
      return;
    }
    navigateBack();
  }, [phase, result, navigateBack]);

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
