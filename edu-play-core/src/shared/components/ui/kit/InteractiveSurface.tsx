import Link from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';
import {
  SEESAW_HOVER_HIGHLIGHT_CLASS,
  SEESAW_HOVER_HIGHLIGHT_STYLE,
  SEESAW_SURFACE_INTERACTION_CLASS,
} from './seesawInteraction';

export interface InteractiveSurfaceProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href'> {
  href: string;
  children: ReactNode;
  /** Surface layout and visual treatment. The component owns interaction chrome only. */
  className?: string;
  /** Token-backed highlight wash. Use a light wash on saturated surfaces. */
  highlightClassName?: string;
}

/**
 * Seesaw-style clickable surface: no lift, only a soft hover/focus wash.
 * Use for card-like links and large dashboard affordances.
 */
export function InteractiveSurface({
  href,
  children,
  className,
  highlightClassName = 'bg-current',
  ...props
}: InteractiveSurfaceProps) {
  return (
    <Link
      href={href}
      className={cn(
        SEESAW_SURFACE_INTERACTION_CLASS,
        className,
      )}
      {...props}
    >
      {children}
      <span
        data-hover-highlight
        aria-hidden="true"
        className={cn(SEESAW_HOVER_HIGHLIGHT_CLASS, highlightClassName)}
        style={SEESAW_HOVER_HIGHLIGHT_STYLE}
      />
    </Link>
  );
}
