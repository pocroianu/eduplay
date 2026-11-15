"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { fadeIn } from "@/config/animations";
import { GameEmbed } from "./GameEmbed";
import { ResultsCard } from "./ResultsCard";
import { ThemedEmptyState } from "./ThemedEmptyState";
import { PreGameCover } from "./PreGameCover";
import { OfflineNotice } from "./OfflineNotice";
import type { CategoryTheme } from "./getCategoryTheme";
import type { GameCompleteResult } from "@/features/games/types/game.types";
import { reducedFade } from "./reduced-motion";

import type { ActivityPlaySession, ProgressSaveStatus } from '../player/activity-play-session';

export type GamePhase = "intro" | "playing" | "complete";

interface GameStageProps {
  session?: ActivityPlaySession;
  saveStatus?: ProgressSaveStatus;
  onRetrySave?: () => void;
  theme: CategoryTheme;
  backUrl: string;
  gameUrl: string | null;
  gameTitle: string;
  playerName: string;
  difficulty: number | null;
  estimatedMinutes: number | null;
  studentId?: string;
  activityId?: string;
  versionId?: string;
  assignmentId?: string;
  configUrl?: string;
  continueHref?: string;
  phase: GamePhase;
  result: GameCompleteResult | null;
  attempts: number;
  playSession: number;
  isMuted: boolean;
  isOffline: boolean;
  loadError: boolean;
  onStart: () => void;
  onBack: () => void;
  onRetryLoad: () => void;
  onRetry: () => void;
  onMuteChange: (muted: boolean) => void;
  onRequestExit: () => void;
  onLoadError: () => void;
  onComplete: (result: GameCompleteResult) => void;
}

export function GameStage({
  session, saveStatus, onRetrySave,
  theme,
  backUrl,
  gameUrl,
  gameTitle,
  playerName,
  difficulty,
  estimatedMinutes,
  studentId,
  activityId,
  versionId,
  assignmentId,
  configUrl,
  continueHref,
  phase,
  result,
  attempts,
  playSession,
  isMuted,
  isOffline,
  loadError,
  onStart,
  onBack,
  onRetryLoad,
  onRetry,
  onMuteChange,
  onRequestExit,
  onLoadError,
  onComplete,
}: GameStageProps) {
  const reduceMotion = useReducedMotion();
  const fadeVariants = reduceMotion ? reducedFade : fadeIn;
  const showOffline =
    Boolean(gameUrl) && (isOffline || loadError) && phase !== "complete";

  return (
    <motion.div
      className="flex-1 relative bg-surface-container-lowest rounded-2xl overflow-hidden min-h-0 mx-3"
      style={{ boxShadow: "var(--shadow-soft)" }}
      layout={!reduceMotion}
    >
      <AnimatePresence mode="wait">
        {!gameUrl && (
          <motion.div
            key="empty"
            className="absolute inset-0"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <ThemedEmptyState theme={theme} backUrl={backUrl} />
          </motion.div>
        )}

        {gameUrl && phase === "intro" && !showOffline && (
          <motion.div
            key="intro"
            className="absolute inset-0"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <PreGameCover
              theme={theme}
              title={gameTitle}
              difficulty={difficulty}
              estimatedMinutes={estimatedMinutes}
              onStart={onStart}
              onBack={onBack}
            />
          </motion.div>
        )}

        {gameUrl && phase === "playing" && !showOffline && (
          <motion.div
            key={`game-${playSession}`}
            className="absolute inset-0"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <GameEmbed
              session={session}
              gameUrl={gameUrl}
              playerName={playerName}
              studentId={studentId}
              activityId={activityId}
              versionId={versionId}
              assignmentId={assignmentId}
              configUrl={configUrl}
              isMuted={isMuted}
              onMuteChange={onMuteChange}
              onRequestExit={onRequestExit}
              onRestart={onRetry}
              onLoadError={onLoadError}
              onComplete={onComplete}
            />
          </motion.div>
        )}

        {gameUrl && showOffline && (
          <motion.div
            key="offline"
            className="absolute inset-0"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <OfflineNotice
              kind={isOffline ? "offline" : "load_error"}
              onRetry={onRetryLoad}
              onBack={onBack}
            />
          </motion.div>
        )}

        {gameUrl && phase === "complete" && result && (
          <motion.div
            key="results"
            className="absolute inset-0"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <ResultsCard
              saveStatus={saveStatus}
              onRetrySave={onRetrySave}
              result={result}
              attempts={attempts}
              onRetry={onRetry}
              continueHref={continueHref}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
