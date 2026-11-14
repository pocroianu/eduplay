'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/shared/lib/utils/cn';

type Placement = 'top' | 'bottom';

export interface DuoTooltipProps {
  /** Tooltip content — keep to 1-2 sentences. */
  content: ReactNode;
  /** Placement relative to trigger. */
  placement?: Placement;
  /** Delay before showing (ms). Defaults to 300. */
  delay?: number;
  /** The trigger element (must accept ref and aria attributes). */
  children: ReactNode;
  className?: string;
}

/**
 * DuoTooltip — contextual help primitive.
 *
 * Renders a Seesaw-style popover card with soft surface shadow on hover/focus.
 * Accessible: uses `role="tooltip"`, links via `aria-describedby`, and shows
 * on both hover and keyboard focus.
 */
export function DuoTooltip({
  content,
  placement = 'top',
  delay = 300,
  children,
  className,
}: DuoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();
  const reduceMotion = useReducedMotion();

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const placementClass =
    placement === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      : 'top-full left-1/2 -translate-x-1/2 mt-2';

  const motionInitial = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y: placement === 'top' ? 4 : -4 };
  const motionAnimate = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0 };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span aria-describedby={visible ? tooltipId : undefined}>
        {children}
      </span>
      <AnimatePresence>
        {visible && (
          <motion.div
            id={tooltipId}
            role="tooltip"
            initial={motionInitial}
            animate={motionAnimate}
            exit={motionInitial}
            transition={{ duration: reduceMotion ? 0.05 : 0.2, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              'absolute z-50 pointer-events-none',
              'max-w-xs rounded-xl px-3 py-2',
              'bg-surface-container-lowest shadow-popover',
              'text-[13px] font-medium leading-snug text-on-surface',
              placementClass,
              className,
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
