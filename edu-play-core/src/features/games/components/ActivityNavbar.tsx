"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Avatar, Button, Progress } from "@/shared/components/ui/kit";
import { Icon } from "@/shared/components/ui/Icon";
import { cn } from "@/shared/lib/utils/cn";

interface ActivityNavbarProps {
  playerName: string;
  currentSet: number;
  totalSets: number;
  repeatEnabled: boolean;
  isPaused: boolean;
  onRepeat: () => void;
  onPause: () => void;
  className?: string;
}

export function ActivityNavbar({
  playerName,
  currentSet,
  totalSets,
  repeatEnabled,
  isPaused,
  onRepeat,
  onPause,
  className,
}: ActivityNavbarProps) {
  const { t } = useTranslation("player");
  const reduceMotion = useReducedMotion();
  const safeTotal = Math.max(0, totalSets);
  const safeCurrent = Math.max(0, Math.min(currentSet, safeTotal));
  const displayTotal = safeTotal > 0 ? safeTotal : 5;
  const displayCurrent = safeTotal > 0 ? safeCurrent : 0;
  const progressValue =
    displayTotal > 0 ? Math.round((displayCurrent / displayTotal) * 100) : 0;
  const progressLabel = t("progress.label", {
    filled: displayCurrent,
    total: displayTotal,
  });

  return (
    <motion.nav
      aria-label={t("activityNavbar.label")}
      className={cn(
        "mx-3 mb-3 grid min-h-28 shrink-0 grid-cols-1 items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-soft-sm",
        "sm:grid-cols-[minmax(0,1fr)_auto] md:grid-cols-3 md:gap-x-4",
        className,
      )}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.24, ease: [0.4, 0, 0.2, 1] }
      }
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={playerName} size={56} tone="blue" />
        <span className="max-w-[6rem] truncate text-lg font-bold text-on-surface sm:max-w-[12rem] sm:text-xl">
          {playerName}
        </span>
      </div>

      <div className="order-2 min-w-0 rounded-kid-button border border-outline-variant bg-primary-soft px-4 py-3 sm:order-3 sm:col-span-2 md:order-none md:col-span-1">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-base font-bold uppercase tracking-widest text-primary-deep">
            {t("pauseOverlay.progress")}
          </span>
          <span className="font-mono text-lg font-bold leading-none text-primary-deep">
            {displayCurrent}/{displayTotal}
          </span>
        </div>
        <Progress
          value={progressValue}
          tone="green"
          height={16}
          ariaLabel={progressLabel}
          className="w-full"
        />
      </div>

      <div className="order-3 grid grid-cols-2 gap-2 sm:order-2 sm:flex sm:items-center sm:justify-end md:order-none md:gap-3">
        <Button
          mode="kid"
          variant="primary"
          size="lg"
          onClick={onRepeat}
          disabled={!repeatEnabled}
          aria-label={
            repeatEnabled
              ? t("activityNavbar.repeat")
              : t("activityNavbar.repeatUnavailable")
          }
          className="min-h-16 w-full shrink-0 sm:w-auto"
        >
          <Icon name="ArrowClockwise" size={24} />
          <span>{t("activityNavbar.repeatShort")}</span>
        </Button>

        <Button
          mode="kid"
          variant={isPaused ? "primary" : "secondary"}
          size="lg"
          onClick={onPause}
          aria-label={
            isPaused ? t("controls.playAria") : t("controls.pauseAria")
          }
          className="min-h-16 w-full shrink-0 sm:w-auto"
        >
          <Icon name={isPaused ? "Play" : "Pause"} size={24} />
          <span>
            {isPaused ? t("controls.resume") : t("activityNavbar.pauseShort")}
          </span>
        </Button>
      </div>
    </motion.nav>
  );
}
