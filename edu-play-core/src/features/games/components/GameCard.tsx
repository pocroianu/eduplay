"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Icon } from '@/shared/components/ui/Icon';
import NextLink from "next/link";
import { ROUTES } from '@/shared/lib/constants/routes';
import { fadeInUp, cardHover, cardTap, thumbnailZoom } from "@/config/animations";
import {
  getCategoryConfig,
  type GameWithProgress,
  type GameStatus,
} from "../types";

interface GameCardProps {
  game: GameWithProgress;
  index?: number;
}

function getStatusBadge(status: GameStatus | undefined) {
  switch (status) {
    case "completed":
      return { label: "Terminat", className: "bg-primary-soft text-primary-deep", icon: "Check" as const };
    case "in_progress":
      return { label: "În progres", className: "bg-blue-soft text-blue-deep", icon: undefined };
    default:
      return { label: "Nou", className: "bg-gold-soft text-gold-deep", icon: undefined };
  }
}

export function GameCard({ game, index = 0 }: GameCardProps) {
  const reduceMotion = useReducedMotion();
  const categoryConfig = getCategoryConfig(game.category);
  const statusBadge = getStatusBadge(game.progress?.status);
  const isCompleted = game.progress?.status === "completed";
  const href = game.launchHref || game.game_url || ROUTES.PLAY.ACTIVITY(game.id);

  return (
    <motion.div
      variants={reduceMotion ? undefined : fadeInUp}
      initial={reduceMotion ? false : "initial"}
      animate="animate"
      whileHover={reduceMotion ? undefined : "hover"}
      whileTap={reduceMotion ? undefined : "tap"}
      custom={index}
      style={{ originX: 0.5, originY: 0.5 }}
      transition={{
        duration: 0.24,
        delay: index * 0.05,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      <motion.div
        className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant shadow-soft-sm relative min-h-[180px] cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
        variants={reduceMotion ? undefined : { ...cardHover, ...cardTap }}
      >
        {/* Status Badge */}
        <span
          className={`absolute top-3 right-3 rounded-full px-3 py-1 text-base font-bold z-[1] ${statusBadge.className}`}
        >
          {statusBadge.icon && <Icon name={statusBadge.icon} size={14} aria-hidden />} {statusBadge.label}
        </span>

        {/* Category Background with Emoji */}
        <div
          className="h-[100px] flex items-center justify-center relative overflow-hidden"
          style={{ backgroundColor: categoryConfig.bgColor }}
        >
          {/* Decorative circles */}
          <div
            className="absolute -top-5 -right-5 w-20 h-20 rounded-full opacity-50"
            style={{ backgroundColor: categoryConfig.hoverColor }}
          />
          <div
            className="absolute -bottom-[30px] -left-2.5 w-[60px] h-[60px] rounded-full opacity-30"
            style={{ backgroundColor: categoryConfig.hoverColor }}
          />

          {/* Category Emoji */}
          <motion.span
            variants={reduceMotion ? undefined : thumbnailZoom}
            className="text-[50px]"
            style={{ filter: isCompleted ? "none" : "grayscale(0)" }}
          >
            <Icon name={categoryConfig.icon} size={50} weight="fill" aria-hidden />
          </motion.span>

          {/* Completion Checkmark Overlay */}
          {isCompleted && (
            <div className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant bg-primary text-on-primary shadow-soft-sm">
              <Icon name="Check" size={20} aria-hidden />
            </div>
          )}
        </div>

        {/* Game Info */}
        <div className="p-4">
          {/* Title with Link */}
          <NextLink href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            <p className="font-bold text-lg line-clamp-2 leading-snug mb-2 text-on-surface">
              {game.title}
            </p>
          </NextLink>

          {/* Difficulty Stars & Progress */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Icon
                  key={i}
                  name="Star"
                  weight={i < (game.difficulty_level || 1) ? 'fill' : 'regular'}
                  size={16}
                  className={i < (game.difficulty_level || 1) ? "text-gold" : "text-outline-variant"}
                />
              ))}
            </div>

            {/* Score if completed */}
            {game.progress?.score !== null &&
              game.progress?.score !== undefined && (
                <span className="text-base font-semibold text-on-surface">
                  {game.progress.score}%
                </span>
              )}
          </div>

          {/* Duration */}
          {game.estimated_duration && (
            <span className="text-base text-on-surface-variant mt-2 block">
              {game.estimated_duration} min
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
