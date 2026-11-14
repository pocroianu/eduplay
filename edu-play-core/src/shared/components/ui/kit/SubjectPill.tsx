import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';

/**
 * Canonical Romanian primary-curriculum subject keys for EduPlay surfaces.
 *
 * Source-of-truth alignment:
 * - `docs/ui-kit.md`, `DESIGN.md` §2.3 / §3.3, and this component define the
 *   product subject-pill contract.
 * - The Postgres schema does NOT enforce a subject enum (`activities.subject`
 *   is free TEXT and `games.category` uses an English preschool taxonomy:
 *   literacy/math/phonics/shapes/colors/vocabulary). The kit-level taxonomy
 *   below is the design-system canonical set; the DB is intentionally looser.
 * - The English subjects listed in the EDU-124 ticket text
 *   (reading/numbers/science/art/play) are confirmed stale.
 *
 * Kit canonical subjects: ROMANA, MATEMATICA, STIINTE, ARTE, MUZICA, SPORT.
 * `muzica` and `sport` cover the full Romanian primary-school curriculum
 * already used by current code.
 */
export const SUBJECT_KEYS = [
  'romana',
  'math',
  'stiinte',
  'arte',
  'muzica',
  'sport',
] as const;

export type SubjectKey = (typeof SUBJECT_KEYS)[number];

export const SUBJECT_LABEL: Record<SubjectKey, string> = {
  romana: 'Română',
  math: 'Matematică',
  stiinte: 'Științe',
  arte: 'Arte',
  muzica: 'Muzică',
  sport: 'Sport',
};

type Tone =
  | 'green'
  | 'blue'
  | 'coral'
  | 'gold'
  | 'purple'
  | 'pink'
  | 'neutral'
  | SubjectKey;

export interface SubjectPillProps {
  tone?: Tone;
  /** When true, adds hover/focus affordance for filter UIs. */
  interactive?: boolean;
  /** Whether this pill is currently selected (only relevant when interactive). */
  selected?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

const TONE_STYLE: Record<Tone, { bg: string; fg: string }> = {
  green:    { bg: 'var(--color-primary-soft)', fg: 'var(--color-primary-deep)' },
  stiinte:  { bg: 'var(--color-primary-soft)', fg: 'var(--color-primary-deep)' },
  blue:     { bg: 'var(--color-blue-soft)',    fg: 'var(--color-blue-deep)' },
  math:     { bg: 'var(--color-blue-soft)',    fg: 'var(--color-blue-deep)' },
  coral:    { bg: 'var(--color-coral-soft)',   fg: 'var(--color-coral-deep)' },
  romana:   { bg: 'var(--color-coral-soft)',   fg: 'var(--color-coral-deep)' },
  gold:     { bg: 'var(--color-gold-soft)',    fg: 'var(--color-gold-deep)' },
  sport:    { bg: 'var(--color-gold-soft)',    fg: 'var(--color-gold-deep)' },
  purple:   { bg: 'var(--color-purple-soft)',  fg: 'var(--color-purple-deep)' },
  muzica:   { bg: 'var(--color-purple-soft)',  fg: 'var(--color-purple-deep)' },
  pink:     { bg: 'var(--color-pink-soft)',    fg: 'var(--color-pink-deep)' },
  arte:     { bg: 'var(--color-pink-soft)',    fg: 'var(--color-pink-deep)' },
  neutral:  { bg: 'var(--color-surface-container)', fg: 'var(--color-ink)' },
};

export function SubjectPill({
  tone = 'green',
  interactive = false,
  selected = false,
  children,
  className,
  onClick,
}: SubjectPillProps) {
  const { bg, fg } = TONE_STYLE[tone];
  const Tag = interactive ? 'button' : 'span';

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      aria-pressed={interactive ? selected : undefined}
      className={cn(
        'inline-flex items-center py-1 px-3 rounded-full font-bold text-xs uppercase tracking-[0.04em]',
        interactive && 'cursor-pointer select-none transition-all duration-150',
        interactive && 'hover:shadow-soft-sm',
        interactive && 'focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2',
        interactive && selected && 'ring-2 ring-primary',
        className,
      )}
      style={{ backgroundColor: bg, color: fg }}
    >
      {children}
    </Tag>
  );
}
