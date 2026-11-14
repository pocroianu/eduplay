"use client";

import { useEffect, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Icon } from "@/shared/components/ui/Icon";

import type { CategoryTheme } from "./getCategoryTheme";
import { GameChromeButton } from "./GameChromeButton";

interface LessonDrawerProps {
  theme: CategoryTheme;
  open: boolean;
  onClose: () => void;
  helperText: string;
}

export function LessonDrawer({
  theme,
  open,
  onClose,
  helperText,
}: LessonDrawerProps) {
  const { t } = useTranslation("player");
  const titleId = useId();
  const closeButtonId = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const closeButton = document.getElementById(closeButtonId);
    closeButton?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [closeButtonId, onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
            }
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            className="fixed bottom-0 right-0 top-0 z-50 flex w-[380px] max-w-[92vw] flex-col bg-surface-container-lowest shadow-modal"
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-outline-variant px-5 py-4">
              <GameChromeButton
                onClick={onClose}
                id={closeButtonId}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t("drawer.close")}
              >
                <Icon name="X" size={22} />
              </GameChromeButton>
              <h2
                id={titleId}
                className="flex-1 font-headline text-[22px] font-bold leading-tight text-on-surface"
              >
                {t("drawer.title")}
              </h2>
            </header>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col gap-6">
                <span
                  className="inline-flex w-fit items-center rounded-full bg-primary-wash px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-deep"
                  style={{
                    backgroundColor: theme.accentSoft,
                    color: theme.accentColor,
                  }}
                >
                  {theme.badge}
                </span>

                <h3 className="font-headline text-2xl font-bold leading-tight text-on-surface">
                  {theme.title}
                </h3>

                <p className="text-lg leading-[1.7] text-on-surface-variant">
                  {theme.subtitle}
                </p>

                <div className="rounded-xl bg-surface p-4 shadow-soft-sm">
                  <p className="text-lg font-medium italic leading-relaxed text-on-surface">
                    &ldquo;{theme.quote}&rdquo;
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {theme.steps.map((step, index) => (
                    <div
                      key={step}
                      className="flex items-center gap-4 rounded-xl bg-surface p-3 shadow-soft-sm"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: theme.accentColor }}
                      >
                        {index + 1}
                      </div>
                      <span className="text-base font-medium text-on-surface">
                        {step}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-outline-variant pt-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: theme.accentSoft,
                        boxShadow: "var(--shadow-soft)",
                      }}
                    >
                      <Icon
                        name="Sparkle"
                        size={20}
                        style={{ color: theme.accentColor }}
                      />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase text-on-surface-variant">
                        {theme.coach}
                      </span>
                      <p className="text-base font-medium">{helperText}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
