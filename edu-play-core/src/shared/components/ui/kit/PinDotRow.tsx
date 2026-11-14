'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/shared/lib/utils/cn';
import { pinShake } from '@/config/animations';

export interface PinDotRowProps {
  /** Number of digits currently entered (0..length). */
  filled: number;
  /** Total number of PIN digits. Defaults to 4. */
  length?: number;
  /** Trigger the wrong-PIN shake animation when this toggles. */
  shakeKey?: number | string;
  /** Accessible status prefix (Romanian default). */
  ariaLabelPrefix?: string;
  /** When true, dots get a green halo to signal correct entry before redirect. */
  success?: boolean;
  className?: string;
}

/**
 * Row of circular dots showing PIN progress. Announces "X din N cifre" via an
 * aria-live region so screen readers track each keypress.
 */
export function PinDotRow({
  filled,
  length = 4,
  shakeKey,
  ariaLabelPrefix = 'PIN',
  success = false,
  className,
}: PinDotRowProps) {
  const prefersReducedMotion = useReducedMotion();
  const dots = Array.from({ length }, (_, i) => i < filled);

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <motion.div
        key={shakeKey}
        variants={prefersReducedMotion ? undefined : pinShake}
        initial={prefersReducedMotion ? false : 'idle'}
        animate={prefersReducedMotion ? undefined : shakeKey ? 'shake' : 'idle'}
        className="flex items-center gap-3"
        aria-hidden="true"
      >
        {dots.map((isFilled, index) => (
          <div
            key={index}
            className={cn(
              'w-7 h-7 rounded-full transition-all duration-200',
              isFilled
                ? 'bg-primary'
                : 'bg-transparent border-[3px] border-outline-variant',
              success && isFilled && 'ring-[6px] ring-primary-soft scale-110',
            )}
          />
        ))}
      </motion.div>
      <p aria-live="polite" className="sr-only">
        {`${ariaLabelPrefix}: ${filled} din ${length} cifre`}
      </p>
    </div>
  );
}
