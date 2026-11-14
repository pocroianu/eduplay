"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Icon } from "@/shared/components/ui/Icon";
import { fadeInUp, staggerContainer, staggerItem } from "@/config/animations";
import type { CategoryTheme } from "./getCategoryTheme";
import {
  reducedFade,
  reducedStagger,
  reducedStaggerItem,
} from "./reduced-motion";

interface ThemedEmptyStateProps {
  theme: CategoryTheme;
  backUrl: string;
}

export function ThemedEmptyState({ theme, backUrl }: ThemedEmptyStateProps) {
  const { t } = useTranslation("player");
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="h-full w-full flex flex-col items-center justify-center text-center px-6 py-8"
      variants={reduceMotion ? reducedStagger : staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Illustrative scene */}
      <motion.div
        className="relative w-24 h-24 mb-4 overflow-hidden"
        variants={reduceMotion ? reducedFade : fadeInUp}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            background: theme.accentSoft,
            opacity: 0.18,
          }}
        />
        <span
          aria-hidden="true"
          className="absolute top-2 left-1 w-2 h-2 rounded-full"
          style={{ background: theme.accentColor, opacity: 0.6 }}
        />
        <span
          aria-hidden="true"
          className="absolute top-3 right-1.5 w-1.5 h-1.5 rounded-full"
          style={{ background: theme.accentColor, opacity: 0.7 }}
        />
        <span
          aria-hidden="true"
          className="absolute bottom-2.5 right-2.5 w-2.5 h-2.5 rounded-full"
          style={{ background: theme.accentColor, opacity: 0.5 }}
        />
        <span
          aria-hidden="true"
          className="absolute bottom-3.5 left-2 w-1.5 h-1.5 rounded-full"
          style={{ background: theme.accentColor, opacity: 0.6 }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 flex items-center justify-center rounded-2xl bg-white"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          <Icon name="Hourglass" size={28} />
        </div>
      </motion.div>

      <motion.h2
        variants={reduceMotion ? reducedStaggerItem : staggerItem}
        className="font-headline text-xl font-bold text-on-surface mb-1.5"
      >
        {t("emptyState.title")}
      </motion.h2>
      <motion.p
        variants={reduceMotion ? reducedStaggerItem : staggerItem}
        className="text-lg text-on-surface-variant max-w-[280px] mb-5"
      >
        {t("emptyState.subtitle")}
      </motion.p>

      {/* Coach callout */}
      <motion.div
        variants={reduceMotion ? reducedStaggerItem : staggerItem}
        className="rounded-2xl px-4 py-3 flex items-center gap-3 mb-6 max-w-[320px]"
        style={{ background: theme.accentSoft }}
      >
        <span
          aria-hidden="true"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white shrink-0"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          <Icon name="Sparkle" size={18} className="text-primary" />
        </span>
        <p className="text-base italic text-left text-on-surface">
          {t("emptyState.coachQuote")}
        </p>
      </motion.div>

      <motion.div variants={reduceMotion ? reducedStaggerItem : staggerItem}>
        <Link
          href={backUrl}
          className="inline-flex items-center gap-2 px-7 py-3.5 text-white font-headline font-bold text-base rounded-full"
          style={{
            background: "var(--color-primary)",
            boxShadow: "var(--shadow-soft)",
            minHeight: "64px",
          }}
        >
          <Icon name="ArrowLeft" size={20} />
          {t("actions.backToGames")}
        </Link>
      </motion.div>
    </motion.div>
  );
}
