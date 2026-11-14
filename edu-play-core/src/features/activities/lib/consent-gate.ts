import type { ConsentKey, ConsentMap, GateResult } from '../types';

/**
 * Translates a type's declarative `requiredConsent` slot + the child's
 * resolved `ConsentMap` into a `GateResult` the player shell can render
 * directly via the EDU-301 framework.
 *
 * Pure (no DB / React) so it can be exercised in unit tests without
 * standing up a Supabase client. Used by the F9 player route to keep
 * the consent shortcut from being a parallel rendering path inside
 * `<ActivityPlayer>`.
 *
 * Returns `undefined` when no consent is required, so the page can pass
 * an absent gate through to the shell unchanged. Only `consents[key] === true`
 * counts as granted; missing/false/undefined all bucket as not granted.
 */
export function resolveConsentGate(
  requiredConsent: ConsentKey | undefined,
  consents: ConsentMap,
): GateResult | undefined {
  if (!requiredConsent) {
    return undefined;
  }
  if (consents[requiredConsent] === true) {
    return { allowed: true };
  }
  return { allowed: false, reason: 'consent_required' };
}
