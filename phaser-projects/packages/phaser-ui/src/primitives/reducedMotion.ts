/**
 * Shared reduced-motion check for Phaser primitives.
 *
 * Source order:
 *   1. game-core's AccessibilityManager (`window.__A11Y_MANAGER__`, set by
 *      GameContextProvider), whose `reducedMotion` setting is the in-iframe
 *      source of truth (persisted + seeded from the OS media query).
 *   2. `matchMedia('(prefers-reduced-motion: reduce)')`.
 *
 * TODO: the web host (GameEmbed's ACTIVITY_INIT message) does not yet send the
 * student's reduced-motion preference, so `.impeccable.md`'s "host passes the
 * flag" is not satisfied. Once ACTIVITY_INIT carries it and game-core applies
 * it via `AccessibilityManager.setReducedMotion`, this helper picks it up
 * with no further change.
 */
export function prefersReducedMotion(_scene?: unknown): boolean {
  if (typeof window === 'undefined') return false;
  const manager = (window as unknown as {
    __A11Y_MANAGER__?: { isReducedMotion?: () => boolean };
  }).__A11Y_MANAGER__;
  if (typeof manager?.isReducedMotion === 'function' && manager.isReducedMotion()) {
    return true;
  }
  if (!window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
