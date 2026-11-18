"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { fadeInUp, staggerContainer, staggerItem } from "@/config/animations";
import { formatDuration } from "@/lib/i18n/formatters";
import { Button } from "@/shared/components/ui/kit";
import { ProgressSaveNotice } from './ProgressSaveNotice';
import { Icon } from "@/shared/components/ui/Icon";
import type { GameCompleteResult } from "@/features/games/types/game.types";
import {
  reducedFade,
  reducedStagger,
  reducedStaggerItem,
} from "./reduced-motion";

import type { ProgressSaveStatus } from '../player/activity-play-session';

interface ResultsCardProps {
  saveStatus?: ProgressSaveStatus;
  onRetrySave?: () => void;
  result: GameCompleteResult;
  attempts: number;
  onRetry: () => void;
  continueHref?: string;
}

const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ResultsCard({
  saveStatus = "idle", onRetrySave,
  result,
  attempts,
  onRetry,
  continueHref,
}: ResultsCardProps) {
  const { t } = useTranslation("player");
  const reduceMotion = useReducedMotion();
  const unsaved = saveStatus === "saving" || saveStatus === "error";
  const safeScore = Math.max(0, Math.min(100, result.score));
  const dashOffset =
    RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * safeScore) / 100;
  const starCount = Math.max(1, Math.min(3, result.starRating));
  const gradientId = useId().replace(/:/g, "-");
  const encouragementKey =
    safeScore >= 90
      ? "results.encouragement.high"
      : safeScore >= 60
        ? "results.encouragement.mid"
        : "results.encouragement.low";
  const starsLabel = t("results.stars", { count: result.starRating });

  return (
    <motion.div
      className="h-full w-full flex flex-col items-center justify-center text-center px-6 py-8 gap-4"
      variants={reduceMotion ? reducedFade : fadeInUp}
      initial="initial"
      animate="animate"
    >
      {/* Score ring */}
      <div className="relative w-[100px] h-[100px]">
        <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-fun-yellow)" />
              <stop offset="100%" stopColor="var(--color-fun-pink)" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--color-outline-variant)"
            strokeWidth="6"
          />
          <motion.circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            initial={{
              strokeDashoffset: reduceMotion ? dashOffset : RING_CIRCUMFERENCE,
            }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{
              duration: reduceMotion ? 0 : 0.3,
              delay: reduceMotion ? 0 : 0.2,
              ease: [0.4, 0, 0.2, 1],
            }}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-headline text-2xl font-bold text-on-surface leading-none">
            {safeScore}%
          </span>
          <span
            className="mt-1 flex items-center justify-center gap-0.5 text-gold"
            aria-label={`${result.starRating} ${starsLabel}`}
          >
            {Array.from({ length: starCount }, (_, index) => (
              <Icon
                key={index}
                name="Star"
                size={16}
                weight="fill"
                aria-hidden
              />
            ))}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <motion.div
        className="flex justify-center gap-8"
        variants={reduceMotion ? reducedStagger : staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div
          variants={reduceMotion ? reducedStaggerItem : staggerItem}
          className="text-center"
        >
          <div className="font-headline text-lg font-bold text-on-surface leading-none">
            {safeScore}
          </div>
          <div className="text-base uppercase font-bold tracking-wider text-on-surface-variant mt-1">
            {t("results.labels.points")}
          </div>
        </motion.div>
        <motion.div
          variants={reduceMotion ? reducedStaggerItem : staggerItem}
          className="text-center"
        >
          <div className="font-headline text-lg font-bold text-on-surface leading-none">
            {formatDuration(result.timeSpent)}
          </div>
          <div className="text-base uppercase font-bold tracking-wider text-on-surface-variant mt-1">
            {t("results.labels.time")}
          </div>
        </motion.div>
        <motion.div
          variants={reduceMotion ? reducedStaggerItem : staggerItem}
          className="text-center"
        >
          <div className="font-headline text-lg font-bold text-on-surface leading-none">
            {Math.max(1, attempts)}
          </div>
          <div className="text-base uppercase font-bold tracking-wider text-on-surface-variant mt-1">
            {t("results.labels.attempts")}
          </div>
        </motion.div>
      </motion.div>

      <ProgressSaveNotice status={saveStatus} onRetry={onRetrySave} showSuccess />

      {/* Encouragement */}
      <p
        className="text-lg italic text-on-surface-variant max-w-[260px]"
        role="status"
        aria-live="polite"
      >
        {t(encouragementKey)}
      </p>

      <div className="mt-2 flex w-full max-w-[420px] flex-col gap-2 sm:flex-row">
        <Button
          mode="kid"
          tone="cream"
          size="lg"
          onClick={onRetry}
          disabled={unsaved}
          className="flex-1"
          aria-label={t("actions.playAgain")}
        >
          <Icon name="ArrowCounterClockwise" size={20} />
          {t("actions.playAgainShort")}
        </Button>
        {continueHref && (
          <Button
            mode="kid"
            tone="lime"
            size="lg"
            href={continueHref}
            disabled={unsaved}
            className="flex-1"
            aria-label={t("actions.continue")}
          >
            {t("actions.continue")}
            <Icon name="ArrowRight" size={20} />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
