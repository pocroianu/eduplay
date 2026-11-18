import type { CSSProperties } from 'react';

/**

 * Shared interaction baseline for EduPlay cards and controls.
 * Keep these values centralized so card, link, and button hover behavior stays

 * reusable: colour/highlight changes, no hover lift transform.
 */

export const EASING_CLASS = 'motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)]';

export const HOVER_HIGHLIGHT_TRIGGER_CLASS =

  'motion-safe:hover:[&>[data-hover-highlight]]:opacity-25 motion-safe:focus-visible:[&>[data-hover-highlight]]:opacity-25';

export const SURFACE_INTERACTION_CLASS =

  `group relative overflow-hidden motion-safe:transition-colors motion-safe:duration-150 ${EASING_CLASS} ${HOVER_HIGHLIGHT_TRIGGER_CLASS} motion-reduce:transition-none`;

export const HOVER_HIGHLIGHT_CLASS =

  `pointer-events-none absolute inset-0 z-20 opacity-0 motion-safe:transition-opacity motion-safe:duration-[250ms] ${EASING_CLASS} motion-reduce:transition-none`;

export const STANDARD_BUTTON_INTERACTION_CLASS =

  `motion-safe:transition-[background-color,color,box-shadow] motion-safe:duration-150 ${EASING_CLASS} motion-reduce:transition-none`;

export const FOCUS_RING_CLASS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export const ACTIVITY_CARD_CHROME_CLASS =
  'border border-b-[3px] border-outline bg-surface-container-lowest shadow-none motion-safe:hover:bg-surface-container';

export const HOVER_HIGHLIGHT_STYLE = {

  borderRadius: 'inherit',

} satisfies CSSProperties;
