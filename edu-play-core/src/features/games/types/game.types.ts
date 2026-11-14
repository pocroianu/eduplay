/**
 * Game-related types for the EduPlay platform
 */

import type { IconName } from '@/shared/components/ui/Icon.registry';

export type GameCategory =
  | 'literacy'
  | 'math'
  | 'phonics'
  | 'shapes'
  | 'colors'
  | 'vocabulary';

export type GameStatus = 'not_started' | 'in_progress' | 'completed';

export interface Game {
  id: string;
  title: string;
  description: string | null;
  template?: string;
  thumbnail_url: string | null;
  game_url: string;
  category: GameCategory | null;
  difficulty_level: number | null;
  target_age_min: number | null;
  target_age_max: number | null;
  estimated_duration: number | null;
  learning_objectives: string[] | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  launchHref?: string;
}

export interface GameProgress {
  id: string;
  student_id: string;
  game_id: string;
  status: GameStatus;
  score: number | null;
  time_spent: number | null;
  attempts: number;
  last_played_at: string | null;
  completed_at: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface GameWithProgress extends Game {
  progress: GameProgress | null;
}

export interface CategoryConfig {
  label: string;
  icon: IconName;
  color: string;
  bgColor: string;
  hoverColor: string;
  badgeClass: string;
}

export const CATEGORY_CONFIG: Record<GameCategory, CategoryConfig> = {
  literacy: {
    label: 'Litere',
    icon: 'BookOpen',
    color: 'var(--color-coral)',
    bgColor: 'var(--color-coral-wash)',
    hoverColor: 'var(--color-coral-soft)',
    badgeClass: 'bg-coral-soft text-coral-deep',
  },
  math: {
    label: 'Numere',
    icon: 'Calculator',
    color: 'var(--color-blue)',
    bgColor: 'var(--color-blue-wash)',
    hoverColor: 'var(--color-blue-soft)',
    badgeClass: 'bg-blue-soft text-blue-deep',
  },
  phonics: {
    label: 'Sunete',
    icon: 'SpeakerSimpleHigh',
    color: 'var(--color-purple)',
    bgColor: 'var(--color-purple-wash)',
    hoverColor: 'var(--color-purple-soft)',
    badgeClass: 'bg-purple-soft text-purple-deep',
  },
  shapes: {
    label: 'Forme',
    icon: 'Shapes',
    color: 'var(--color-gold)',
    bgColor: 'var(--color-gold-wash)',
    hoverColor: 'var(--color-gold-soft)',
    badgeClass: 'bg-gold-soft text-gold-deep',
  },
  colors: {
    label: 'Culori',
    icon: 'Palette',
    color: 'var(--color-pink)',
    bgColor: 'var(--color-pink-wash)',
    hoverColor: 'var(--color-pink-soft)',
    badgeClass: 'bg-pink-soft text-pink-deep',
  },
  vocabulary: {
    label: 'Cuvinte',
    icon: 'TextAa',
    color: 'var(--color-gold)',
    bgColor: 'var(--color-gold-wash)',
    hoverColor: 'var(--color-gold-soft)',
    badgeClass: 'bg-gold-soft text-gold-deep',
  },
};

export const ALL_CATEGORIES: GameCategory[] = [
  'literacy',
  'math',
  'phonics',
  'shapes',
  'colors',
  'vocabulary',
];

/**
 * Payload sent from GameEmbed when a game completes.
 * Consumed by GamePageContent to render the ResultsCard.
 *
 * Note: this is the *enriched* domain type. The raw `GAME_COMPLETE`
 * wire message has `starRating?: number` (optional); the GameEmbed
 * handler is responsible for normalizing it to a guaranteed 1–3 value
 * (defaulting from `score` when missing) before invoking `onComplete`.
 */
export interface GameCompleteResult {
  score: number;       // 0–100
  timeSpent: number;   // seconds
  starRating: number;  // 1–3 (always set — see note above)
  totalSets: number;   // total challenges in the game
}

/**
 * Get category configuration, with fallback for unknown categories
 */
export function getCategoryConfig(category: string | null): CategoryConfig {
  if (category && category in CATEGORY_CONFIG) {
    return CATEGORY_CONFIG[category as GameCategory];
  }
  // Default fallback
  return {
    label: 'Jocuri',
    icon: 'GameController',
    color: 'var(--color-on-surface-variant)',
    bgColor: 'var(--color-surface-container)',
    hoverColor: 'var(--color-surface-alt)',
    badgeClass: 'bg-surface-container text-on-surface-variant',
  };
}
