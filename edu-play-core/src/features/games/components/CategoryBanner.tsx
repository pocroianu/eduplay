"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Icon } from "@/shared/components/ui/Icon";
import { fadeInUp } from "@/config/animations";
import type { CategoryTheme } from "./getCategoryTheme";
import { GameChromeButton } from "./GameChromeButton";
import { reducedStaggerItem } from "./reduced-motion";

interface CategoryBannerProps {
  theme: CategoryTheme;
  title: string;
  backUrl: string;
  totalDots: number;
  filledDots: number;
  isComplete: boolean;
  onBack?: () => void;
}

export function CategoryBanner({
  theme,
  title,
  backUrl,
  totalDots,
  filledDots,
  isComplete,
  onBack,
}: CategoryBannerProps) {
  const { t } = useTranslation("player");
  const reduceMotion = useReducedMotion();
  const backLabel = t("actions.backToGames");
  const badgeLabel = isComplete ? t("banner.complete") : theme.badge;
  return (
    <motion.header
      className="z-30 shrink-0 border-b border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-soft-sm"
      variants={reduceMotion ? reducedStaggerItem : fadeInUp}
      initial="initial"
      animate="animate"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        {onBack ? (
          <GameChromeButton
            onClick={onBack}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:bg-primary-soft hover:text-primary-deep focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            aria-label={backLabel}
          >
            <Icon name="ArrowLeft" size={20} aria-hidden />
          </GameChromeButton>
        ) : (
          <Link
            href={backUrl}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:bg-primary-soft hover:text-primary-deep focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            aria-label={backLabel}
          >
            <Icon name="ArrowLeft" size={20} aria-hidden />
          </Link>
        )}

        <div
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-deep"
        >
          <Icon name={theme.icon} size={22} weight="fill" />
        </div>

        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={badgeLabel}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 3 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
              className="text-xs font-bold text-primary-deep"
            >
              {badgeLabel}
            </motion.div>
          </AnimatePresence>
          <h1 className="truncate font-headline text-base font-bold text-on-surface">
            {title}
          </h1>
        </div>

        <div
          className="flex shrink-0 items-center gap-1.5"
          aria-label={t("progress.label", {
            filled: filledDots,
            total: totalDots,
          })}
        >
          {Array.from({ length: totalDots }).map((_, i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full"
              style={{
                background:
                  i < filledDots
                    ? "var(--color-primary)"
                    : "var(--color-outline-variant)",
              }}
            />
          ))}
        </div>
      </div>
    </motion.header>
  );
}
