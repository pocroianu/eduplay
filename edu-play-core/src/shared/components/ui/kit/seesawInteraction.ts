import type { CSSProperties } from 'react';

/**

 * Shared interaction baseline for EduPlay cards and controls.
 * Keep these values centralized so card, link, and button hover behavior stays

 * reusable: colour/highlight changes, no hover lift transform.
 */

export const SEESAW_CARD_ACTION_AREA_HOVER_CAPTURE = {

  hoverRule: '.MuiCardActionArea-root:hover .MuiCardActionArea-focusHighlight { opacity: 0.25; }',

  focusHighlightRule:

    '.MuiCardActionArea-focusHighlight { inset: 0px; opacity: 0; overflow: hidden; position: absolute; transition: opacity 250ms cubic-bezier(0.4, 0, 0.2, 1); border-radius: inherit; pointer-events: none; background-color: currentcolor; }',

  iconButtonHoverRule:

    '.MuiIconButton-root:hover { background-color: rgb(229, 225, 230); transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1); }',

  containedPrimaryHoverRule:

    '.MuiButton-containedPrimary:hover { background-color: rgb(51, 0, 114); }',

  activityCardChromeRule:

    '.jss320 { border-width: 1px 1px 3px; border-style: solid; border-color: rgb(216, 221, 227); background-color: rgb(255, 255, 255); box-shadow: none; }',

  activityCardHoverRule: '.jss319:hover { background-color: rgb(229, 225, 230) !important; }',

} as const;

export const SEESAW_EASING_CLASS = 'motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)]';

export const SEESAW_HOVER_HIGHLIGHT_TRIGGER_CLASS =

  'motion-safe:hover:[&>[data-hover-highlight]]:opacity-25 motion-safe:focus-visible:[&>[data-hover-highlight]]:opacity-25';

export const SEESAW_SURFACE_INTERACTION_CLASS =

  `group relative overflow-hidden motion-safe:transition-colors motion-safe:duration-150 ${SEESAW_EASING_CLASS} ${SEESAW_HOVER_HIGHLIGHT_TRIGGER_CLASS} motion-reduce:transition-none`;

export const SEESAW_HOVER_HIGHLIGHT_CLASS =

  `pointer-events-none absolute inset-0 z-20 opacity-0 motion-safe:transition-opacity motion-safe:duration-[250ms] ${SEESAW_EASING_CLASS} motion-reduce:transition-none`;

export const SEESAW_STANDARD_BUTTON_INTERACTION_CLASS =

  `motion-safe:transition-[background-color,color,box-shadow] motion-safe:duration-150 ${SEESAW_EASING_CLASS} motion-reduce:transition-none`;

export const SEESAW_FOCUS_RING_CLASS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export const SEESAW_ACTIVITY_CARD_CHROME_CLASS =
  'border border-b-[3px] border-outline bg-surface-container-lowest shadow-none motion-safe:hover:bg-surface-container';

export const SEESAW_HOVER_HIGHLIGHT_STYLE = {

  borderRadius: 'inherit',

} satisfies CSSProperties;
