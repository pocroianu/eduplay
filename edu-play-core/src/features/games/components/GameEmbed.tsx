"use client";

import { useEffect, useRef, useState, useCallback, useMemo, useSyncExternalStore } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { fadeIn, fadeInUp } from "@/config/animations";
import { Icon } from "@/shared/components/ui/Icon";
import { Button, Card } from "@/shared/components/ui/kit";
import type { GameCompleteResult } from "@/features/games/types/game.types";
import { recordActivityArtifact } from "@/features/portfolio";
import {
  resolveTrustedGameOrigin,
  type GameControlAction,
} from "@edu-play/activity-protocol";
import type { ActivityPlaySession } from '../player/activity-play-session';
import { useActivityPlaySession } from '../player/use-activity-play-session';
import { ProgressSaveNotice } from './ProgressSaveNotice';
import { ActivityNavbar } from "./ActivityNavbar";
import { reducedFade } from "./reduced-motion";
import { withConfigUrl } from "./with-config-url";

/**
 * Resolves a game URL to an absolute URL when needed.
 * - /storage/v1/... paths → prepend NEXT_PUBLIC_SUPABASE_URL (Supabase Storage)
 * - http(s):// URLs → use as-is
 * - Other paths (e.g. /games/...) → use as-is (legacy public/ serving)
 */
function resolveGameUrl(gameUrl: string): string {
  if (gameUrl.startsWith("/storage/v1/")) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      return `${supabaseUrl.replace(/\/+$/, "")}${gameUrl}`;
    }
  }
  return gameUrl;
}

/**
 * Derives the trusted origin from a resolved game URL.
 *
 * SECURITY: This must only be called on the client (from effects or event
 * handlers). It never returns an empty string and never falls back to `'*'`.
 * A wildcard would let any page forge `GAME_COMPLETE` scores, so we fail closed.
 */
function getTrustedOrigin(gameUrl: string): string {
  if (typeof window === "undefined") {
    throw new Error("getTrustedOrigin must be called on the client");
  }

  return resolveTrustedGameOrigin(gameUrl, window.location.origin);
}

interface GameEmbedProps {
  session?: ActivityPlaySession;
  gameUrl: string;
  studentId?: string;
  isMuted?: boolean;
  activityId?: string;
  versionId?: string;
  assignmentId?: string;
  /**
   * Optional same-origin URL the Phaser game should fetch its config from
   * instead of its bundled static config (e.g. published activity versions
   * served by `/api/v1/activities/:id/config`).
   *
   * When set, the value is appended to the iframe URL as `?configUrl=…` so
   * the Phaser Preload scene can read it synchronously. Per the Activity
   * iframe protocol, this boot-critical URL is not sent in ACTIVITY_INIT.
   */
  configUrl?: string;
  playerName: string;
  onMuteChange?: (muted: boolean) => void;
  onRequestExit?: () => void;
  onRestart?: () => void;
  onLoadError?: () => void;
  onComplete?: (result: GameCompleteResult) => void;
}

export function GameEmbed({
  session: providedSession,
  gameUrl,
  studentId,
  activityId,
  versionId,
  assignmentId,
  isMuted = false,
  configUrl,
  playerName,
  onMuteChange,
  onRequestExit,
  onRestart,
  onLoadError,
  onComplete,
}: GameEmbedProps) {
  const { t } = useTranslation("player");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fallbackSession = useActivityPlaySession({ studentId, activityId, versionId, assignmentId });
  const session = providedSession ?? fallbackSession;
  const sessionState = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const { ready: gameReady, paused: isPaused, repeatEnabled, timeSpent, currentSet, totalSets } = sessionState;
  const isLoading = !gameReady;
  const resolvedUrl = useMemo(() => resolveGameUrl(gameUrl), [gameUrl]);
  const iframeSrc = useMemo(
    () => withConfigUrl(resolvedUrl, configUrl),
    [resolvedUrl, configUrl],
  );
  const reduceMotion = useReducedMotion();
  const fadeVariants = reduceMotion ? reducedFade : fadeIn;

  // Watchdog: if the game iframe never emits ACTIVITY_READY within 20s, treat as load error.
  useEffect(() => {
    if (gameReady) return;
    const timer = setTimeout(() => {
      if (!gameReady) {
        onLoadError?.();
      }
    }, 20000);
    return () => clearTimeout(timer);
  }, [gameReady, onLoadError]);

  useEffect(() => {
    const trustedOrigin = getTrustedOrigin(resolvedUrl);
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== trustedOrigin) return;
      if (event.source && event.source !== iframeRef.current?.contentWindow) return;
      const completion = session.receive(event.data);
      if (!completion) return;
      if (studentId && activityId && completion.screenshotDataUrl?.startsWith('data:image/png;base64,')) {
        void recordActivityArtifact({
          studentId, activityId, versionId, assignmentId,
          screenshotDataUrl: completion.screenshotDataUrl, score: completion.score,
        }).then(result => {
          if (!result.success) console.error('Failed to record activity artifact');
        }).catch(() => console.error('Failed to record activity artifact'));
      }
      const result = session.getSnapshot().result;
      if (result) onComplete?.(result);
    };
    window.addEventListener('message', handleMessage);
    const interval = setInterval(session.tick, 1000);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, [session, resolvedUrl, studentId, activityId, versionId, assignmentId, onComplete]);

  const sendControl = useCallback(
    (action: Exclude<GameControlAction, "restart">) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "GAME_CONTROL", action },
        getTrustedOrigin(resolvedUrl),
      );
    },
    [resolvedUrl],
  );

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      iframeRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const togglePause = () => {
    const next = !isPaused;
    session.pause(next);
    sendControl(next ? "pause" : "resume");
  };

  const handleRepeat = () => {
    if (!repeatEnabled) return;
    sendControl("repeatInstruction");
  };

  const handleRestart = () => {
    session.exit();
    onRestart?.();
  };

  const toggleMute = () => {
    const next = !isMuted;
    onMuteChange?.(next);
    sendControl(next ? "mute" : "unmute");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl"
      style={{ background: "var(--color-surface)" }}
      variants={fadeVariants}
      initial="initial"
      animate="animate"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence>
          {isLoading && (
            <motion.div
              className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-4"
              style={{ background: "var(--color-surface)" }}
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              role="status"
              aria-live="polite"
            >
              <motion.div
                className="flex h-20 w-20 items-center justify-center rounded-2xl border border-outline-variant bg-primary text-on-primary shadow-soft-sm"
                initial={{ opacity: 0 }}
                animate={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 1, rotate: [0, 10, -10, 0] }
                }
                transition={{
                  opacity: { duration: reduceMotion ? 0 : 0.3 },
                  ...(reduceMotion
                    ? {}
                    : {
                        rotate: {
                          duration: 1.8,
                          repeat: Infinity,
                          ease: "easeInOut",
                        },
                      }),
                }}
              >
                <Icon name="Sparkle" size={36} />
              </motion.div>
              <motion.span
                className="font-headline text-lg font-bold text-on-surface"
                variants={reduceMotion ? reducedFade : fadeInUp}
                initial="initial"
                animate="animate"
              >
                {t("loading.preparingAdventure")}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="absolute inset-0 h-full w-full"
          style={{ border: "none" }}
          onLoad={() => {
            iframeRef.current?.contentWindow?.postMessage(
              {
                type: "ACTIVITY_INIT",
                language: "ro",
                studentId: studentId || undefined,
                activityId: activityId || undefined,
                versionId: versionId || undefined,
                assignmentId: assignmentId || undefined,
                muted: isMuted,
              },
              getTrustedOrigin(iframeSrc),
            );
          }}
          onError={() => {
            onLoadError?.();
          }}
          allow="autoplay; fullscreen"
          title={t("iframe.title")}
        />
      </div>

      <ProgressSaveNotice status={sessionState.saveStatus} onRetry={session.retrySave} />

      {gameReady && !isLoading && (
        <ActivityNavbar
          playerName={playerName}
          currentSet={currentSet}
          totalSets={totalSets}
          repeatEnabled={repeatEnabled}
          isPaused={isPaused}
          onRepeat={handleRepeat}
          onPause={togglePause}
        />
      )}

      <AnimatePresence>
        {isPaused && (
          <motion.div
            className="absolute inset-0 z-[30] flex items-center justify-center px-4"
            style={{
              background:
                "color-mix(in srgb, var(--color-on-surface) 58%, transparent)",
            }}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            role="status"
            aria-live="polite"
            aria-label={t("pauseOverlay.alertLabel")}
          >
            <motion.div
              className="w-full max-w-[520px]"
              initial={reduceMotion ? { opacity: 0 } : { y: 20, opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { y: 20, opacity: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.24, ease: [0.4, 0, 0.2, 1] }
              }
            >
              <Card
                mode="standard"
                tone="cream"
                padding="lg"
                className="border border-outline-variant shadow-soft"
              >
                <div className="flex flex-col items-center gap-4 text-center">
                  <div
                    aria-hidden="true"
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border border-outline-variant bg-blue-wash text-blue-deep shadow-soft-sm"
                  >
                    <Icon name="Pause" size={28} />
                  </div>
                  <div>
                    <h2 className="font-headline text-2xl font-bold text-on-surface">
                      {t("pauseOverlay.title")}
                    </h2>
                    <p className="mt-1 text-base text-on-surface-variant">
                      {t("pauseOverlay.subtitle")}
                    </p>
                  </div>

                  <div className="grid w-full grid-cols-2 gap-2 rounded-2xl bg-surface-container p-3 text-left">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                        {t("results.labels.time")}
                      </p>
                      <p className="font-headline text-xl font-bold text-on-surface">
                        {formatTime(timeSpent)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                        {t("pauseOverlay.progress")}
                      </p>
                      <p className="font-headline text-xl font-bold text-on-surface">
                        {totalSets > 0 ? `${currentSet}/${totalSets}` : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="grid w-full gap-2 sm:grid-cols-2">
                    <Button
                      mode="standard"
                      variant="primary"
                      size="lg"
                      onClick={togglePause}
                      className="min-h-16 w-full"
                      aria-label={t("controls.playAria")}
                    >
                      <Icon name="Play" size={20} />
                      {t("pauseOverlay.resume")}
                    </Button>
                    <Button
                      mode="standard"
                      variant="secondary"
                      size="lg"
                      onClick={handleRestart}
                      className="min-h-16 w-full"
                      aria-label={t("pauseOverlay.restart")}
                    >
                      <Icon name="ArrowCounterClockwise" size={20} />
                      {t("pauseOverlay.restart")}
                    </Button>
                    <Button
                      mode="standard"
                      variant="secondary"
                      size="lg"
                      onClick={toggleMute}
                      className="min-h-16 w-full"
                      aria-label={
                        isMuted
                          ? t("controls.muteOnAria")
                          : t("controls.muteOffAria")
                      }
                    >
                      <Icon
                        name={
                          isMuted ? "SpeakerSimpleSlash" : "SpeakerSimpleHigh"
                        }
                        size={20}
                      />
                      {isMuted
                        ? t("pauseOverlay.soundOn")
                        : t("pauseOverlay.soundOff")}
                    </Button>
                    <Button
                      mode="standard"
                      variant="secondary"
                      size="lg"
                      onClick={toggleFullscreen}
                      className="min-h-16 w-full"
                      aria-label={
                        isFullscreen
                          ? t("controls.fullscreenExit")
                          : t("controls.fullscreenEnter")
                      }
                    >
                      <Icon
                        name={isFullscreen ? "CornersIn" : "CornersOut"}
                        size={20}
                      />
                      {isFullscreen
                        ? t("pauseOverlay.fullscreenExit")
                        : t("pauseOverlay.fullscreenEnter")}
                    </Button>
                  </div>

                  {onRequestExit && (
                    <Button
                      mode="standard"
                      variant="secondary"
                      size="lg"
                      onClick={onRequestExit}
                      className="min-h-16 w-full"
                      aria-label={t("pauseOverlay.exit")}
                    >
                      <Icon name="SignOut" size={18} />
                      {t("pauseOverlay.exit")}
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
