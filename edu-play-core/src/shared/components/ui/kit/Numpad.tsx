'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ChunkyButton } from './ChunkyButton';
import { Icon } from '@/shared/components/ui/Icon';
import { cn } from '@/shared/lib/utils/cn';
import { staggerContainer, staggerItem } from '@/config/animations';

export interface NumpadProps {
  onDigit: (digit: number) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  /** Disables every key (e.g. during server action pending). */
  disabled?: boolean;
  /** Disables only the submit key — used until PIN is fully entered. */
  submitDisabled?: boolean;
  /** True when the submit button should show a pending spinner. */
  isPending?: boolean;
  /**
   * Visual density. `comfortable` (default) is the classic 320 px max-width with
   * ~100 px keys. `compact` shrinks to 260 px so a 4-row pad fits inside short
   * landscape viewports (e.g. classroom tablets, laptops). Keys stay safely
   * above the 64 px kid-mode touch-target floor.
   */
  density?: 'comfortable' | 'compact';
  /** Disable entrance staggering for screenshot-stable compact auth surfaces. */
  animated?: boolean;
  className?: string;
}

const ROWS: readonly (readonly number[])[] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
] as const;

// Each cell fills its grid track as a square ChunkyButton. The 320 px max-width
// container keeps every key well above the 64 × 64 kid-mode floor (DESIGN.md §4.5).
const KEY_BASE = 'w-full h-full aspect-square p-0 rounded-kid-button';

/**
 * Numpad used on the student PIN screen. Grid is 3×4: three rows of digit
 * keys, then backspace · 0 · submit. Each key is a `ChunkyButton size="lg"`,
 * with role-tuned variants: `ghost` digits, `ink` backspace, `green` submit.
 */
export function Numpad({
  onDigit,
  onBackspace,
  onSubmit,
  disabled,
  submitDisabled,
  isPending,
  density = 'comfortable',
  animated = true,
  className,
}: NumpadProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animated && !prefersReducedMotion;

  const motionProps = shouldAnimate
    ? {
        variants: staggerContainer,
        initial: 'initial',
        animate: 'animate',
      }
    : {};

  const densityClass =
    density === 'compact'
      ? 'gap-2.5 max-w-[260px]'
      : 'gap-3 max-w-[320px]';

  return (
    <motion.div
      {...motionProps}
      className={cn(
        'grid grid-cols-3 w-full mx-auto',
        densityClass,
        className,
      )}
    >
      {ROWS.flat().map((digit) => (
        <DigitKey
          key={digit}
          digit={digit}
          onClick={() => onDigit(digit)}
          disabled={disabled}
          shouldAnimate={shouldAnimate}
        />
      ))}
      <BackspaceKey
        onClick={onBackspace}
        disabled={disabled}
        shouldAnimate={shouldAnimate}
      />
      <DigitKey
        digit={0}
        onClick={() => onDigit(0)}
        disabled={disabled}
        shouldAnimate={shouldAnimate}
      />
      <SubmitKey
        onClick={onSubmit}
        disabled={disabled || submitDisabled}
        isPending={!!isPending}
        shouldAnimate={shouldAnimate}
      />
    </motion.div>
  );
}

type KeyCommon = {
  onClick: () => void;
  disabled?: boolean;
  shouldAnimate: boolean;
};

function DigitKey({
  digit,
  onClick,
  disabled,
  shouldAnimate,
}: KeyCommon & { digit: number }) {
  return (
    <KeyShell shouldAnimate={shouldAnimate}>
      <ChunkyButton
        variant="ghost"
        size="lg"
        onClick={onClick}
        disabled={disabled}
        aria-label={`Cifra ${digit}`}
        className={cn(KEY_BASE, 'type-headline')}
      >
        {digit}
      </ChunkyButton>
    </KeyShell>
  );
}

function BackspaceKey({ onClick, disabled, shouldAnimate }: KeyCommon) {
  return (
    <KeyShell shouldAnimate={shouldAnimate}>
      <ChunkyButton
        variant="ink"
        size="lg"
        onClick={onClick}
        disabled={disabled}
        aria-label="Șterge"
        className={KEY_BASE}
      >
        <Icon name="ArrowLeft" size={32} aria-hidden />
      </ChunkyButton>
    </KeyShell>
  );
}

function SubmitKey({
  onClick,
  disabled,
  isPending,
  shouldAnimate,
}: KeyCommon & { isPending: boolean }) {
  return (
    <KeyShell shouldAnimate={shouldAnimate}>
      <ChunkyButton
        variant="green"
        size="lg"
        onClick={onClick}
        disabled={disabled}
        aria-label="Trimite PIN-ul"
        aria-busy={isPending || undefined}
        className={KEY_BASE}
      >
        {isPending ? (
          <span
            aria-hidden="true"
            className="w-6 h-6 border-[3px] border-white border-t-transparent rounded-full animate-spin"
          />
        ) : (
          <Icon name="Check" weight="bold" size={36} aria-hidden />
        )}
      </ChunkyButton>
    </KeyShell>
  );
}

type KeyShellProps = {
  shouldAnimate: boolean;
  children: React.ReactNode;
};

function KeyShell({ shouldAnimate, children }: KeyShellProps) {
  if (!shouldAnimate) {
    return <div className="w-full h-full">{children}</div>;
  }
  return (
    <motion.div variants={staggerItem} className="w-full h-full">
      {children}
    </motion.div>
  );
}
