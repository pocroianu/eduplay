"use client";

import { useId, type ReactNode } from "react";
import { Modal } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";

import { motion, useReducedMotion } from "framer-motion";

import { Button } from "./Button";

import { Icon } from "@/shared/components/ui/Icon";

import { RewardGlyph, type RewardGlyphKind } from "./RewardGlyph";

import { Vulpita, type VulpitaMood } from "./Vulpita";

export type RewardTone =
  | "gold"
  | "blue"
  | "coral"
  | "green"
  | "purple"
  | "pink";

export interface RewardItem {
  /** Stable identifier — used as React key. */

  id: string;

  /** Visual tone of the chip. Drives the swatch + foreground colors. */

  tone: RewardTone;

  /** Built-in glyph (XP, gem, heart, trophy, flame). */

  glyph?: RewardGlyphKind;

  /** Custom node rendered in the swatch when no `glyph` is provided. */

  icon?: ReactNode;

  /** Big number/amount. Pre-formatted by the caller (e.g. "+150", "7"). */

  value: string;

  /** Tiny uppercase caption underneath the value. */

  label: string;
}

export interface RewardModalProps {
  /** Controls visibility. The modal mounts the AnimatePresence subtree. */

  open: boolean;

  /** Fires on Escape and the default CTA. Backdrop click is intentionally ignored

   *  (DESIGN.md §4.4 — kids tap by accident). */

  onDismiss: () => void;

  /** Tiny uppercase eyebrow above the title — e.g. "Nivel nou!". */

  eyebrow?: string;

  /** Big celebratory headline. */

  title: ReactNode;

  /** One-line subtitle below the title. */

  subtitle?: ReactNode;

  /** Reward chips strip (XP, gems, streak…). */

  rewards?: RewardItem[];

  /**

   * Optional notice line beneath the rewards strip (e.g. parent/teacher notification).

   * Renders with a leading envelope glyph by default; supply a `noticeIcon` to override.

   */

  notice?: ReactNode;

  noticeIcon?: ReactNode;

  /** Mascot mood. Defaults to `cheer` for level-up energy. */

  mascotMood?: VulpitaMood;

  /** CTA copy. Defaults to "Mai departe!". */

  ctaLabel?: string;

  /**

   * Replace the default CTA with a custom action surface. When provided,

   * `ctaLabel` is ignored. Use this when you need multiple buttons or

   * a custom layout. Receives `dismiss` so consumers can wire close behavior.

   */

  actions?: (dismiss: () => void) => ReactNode;

  /** Accessible label override; defaults to the eyebrow + title combination. */

  ariaLabel?: string;
}

const CONFETTI = [
  { c: "var(--color-gold)", x: 12, y: 18, s: 18 },

  { c: "var(--color-coral)", x: 82, y: 12, s: 14 },

  { c: "var(--color-pink)", x: 88, y: 60, s: 16 },

  { c: "var(--color-purple)", x: 8, y: 50, s: 16 },

  { c: "var(--color-blue)", x: 22, y: 78, s: 14 },

  { c: "var(--color-primary)", x: 72, y: 82, s: 18 },

  { c: "var(--color-gold)", x: 50, y: 8, s: 12 },

  { c: "var(--color-coral)", x: 48, y: 92, s: 14 },
] as const;

const SPARKS = [
  { x: 28, y: 30, s: 22, delay: 0 },

  { x: 72, y: 28, s: 18, delay: 0.15 },

  { x: 20, y: 55, s: 14, delay: 0.3 },

  { x: 80, y: 58, s: 16, delay: 0.45 },
] as const;

const REWARD_TONE_STYLE: Record<RewardTone, string> = {
  gold: "bg-gold-soft text-gold-deep",

  blue: "bg-blue-soft text-blue-deep",

  coral: "bg-coral-soft text-coral-deep",

  green: "bg-primary-soft text-primary-deep",

  purple: "bg-purple-soft text-purple-deep",

  pink: "bg-pink-soft text-pink-deep",
};

export function RewardModal({
  open,

  onDismiss,

  eyebrow,

  title,

  subtitle,

  rewards,

  notice,

  noticeIcon,

  mascotMood = "cheer",

  ctaLabel = "Mai departe!",

  actions,

  ariaLabel,
}: RewardModalProps) {
  const shouldReduceMotion = useReducedMotion();

  const subtitleId = useId();

  const eyebrowId = useId();

  const ctaId = useId();

  return (
    <MantineBoundary>
      <Modal.Root
        opened={open}
        onClose={onDismiss}
        closeOnClickOutside={false}
        centered
        size={520}
        zIndex={60}
        transitionProps={{ duration: shouldReduceMotion ? 0 : 200 }}
      >
        <Modal.Overlay />
        <Modal.Content aria-label={ariaLabel} style={{ overflow: "hidden" }}>
          <Modal.Body p={0}>
            {" "}
            {/* Confetti — purely decorative */}
            {CONFETTI.map((c, i) => (
              <motion.div
                key={`confetti-${i}`}
                aria-hidden="true"
                className="absolute pointer-events-none"
                style={{
                  left: `${c.x}%`,

                  top: `${c.y}%`,

                  width: c.s,

                  height: c.s,

                  background: c.c,

                  borderRadius: 3,
                }}
                initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }}
                animate={
                  shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.2, ease: [0.4, 0, 0.2, 1], delay: i * 0.02 }
                }
              />
            ))}
            {/* Sparks */}
            {SPARKS.map((sp, i) => (
              <motion.div
                key={`spark-${i}`}
                aria-hidden="true"
                className="absolute pointer-events-none"
                style={{ left: `${sp.x}%`, top: `${sp.y}%` }}
                initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
                animate={
                  shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 0.2,
                        ease: [0.4, 0, 0.2, 1],
                        delay: 0.08 + sp.delay,
                      }
                }
              >
                <Icon
                  name="Sparkle"
                  size={sp.s}
                  weight="fill"
                  className="text-gold"
                />
              </motion.div>
            ))}
            {/* Main panel */}
            <motion.div
              className="relative z-10 mx-auto flex max-h-[90vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-surface-container-lowest text-center shadow-modal"
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }
              }
              animate={
                shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
              }
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.05 }
                  : { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
              }
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                {/* Mascot */}

                <div className="relative mb-1 inline-flex rounded-full bg-primary-soft p-3">
                  <Vulpita size={156} mood={mascotMood} />
                </div>

                {eyebrow && (
                  <div
                    id={eyebrowId}
                    className="mt-3 type-label text-primary-deep"
                  >
                    {eyebrow}
                  </div>
                )}

                {ariaLabel ? (
                  <h2 className="mt-1 type-display-sm text-on-surface">
                    {title}
                  </h2>
                ) : (
                  <Modal.Title className="mt-1 type-display-sm text-on-surface">
                    {title}
                  </Modal.Title>
                )}

                {subtitle && (
                  <p
                    id={subtitleId}
                    className="mx-auto mt-2 max-w-[34rem] type-body text-on-surface-variant"
                  >
                    {subtitle}
                  </p>
                )}

                {rewards && rewards.length > 0 && (
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    {rewards.map((reward) => (
                      <div
                        key={reward.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-surface-container px-3 py-2 text-on-surface shadow-soft-sm"
                      >
                        {reward.glyph ? (
                          <span
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${REWARD_TONE_STYLE[reward.tone]}`}
                          >
                            <RewardGlyph kind={reward.glyph} size={20} />
                          </span>
                        ) : reward.icon ? (
                          <span
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${REWARD_TONE_STYLE[reward.tone]}`}
                          >
                            {reward.icon}
                          </span>
                        ) : null}

                        <span className="type-display-sm">{reward.value}</span>

                        <span className="type-label-sm text-on-surface-variant">
                          {reward.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {notice && (
                  <div className="mt-[18px] inline-flex items-center gap-1.5 type-body text-on-surface-variant">
                    <span aria-hidden="true" className="flex items-center">
                      {noticeIcon ?? <Icon name="Envelope" size={14} />}
                    </span>

                    <span>{notice}</span>
                  </div>
                )}
              </div>

              <div className="flex w-full justify-end border-t border-outline-variant px-5 py-4">
                {actions ? (
                  actions(onDismiss)
                ) : (
                  <Button
                    id={ctaId}
                    data-autofocus
                    mode="kid"
                    variant="primary"
                    size="lg"
                    onClick={onDismiss}
                  >
                    {ctaLabel}
                  </Button>
                )}
              </div>
            </motion.div>
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </MantineBoundary>
  );
}
