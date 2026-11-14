'use client';

import { getFlag, type FeatureFlag } from './flags';

/**
 * Read a feature flag from a Client Component.
 *
 * v1 implementation reads `process.env.NEXT_PUBLIC_*` directly. Next.js inlines
 * these at build time, so the same value is observed on both server and client
 * — no provider or hydration boundary is required for env-var flags.
 *
 * If/when flag values become dynamic (e.g. DB-backed admin overrides), this
 * hook should be expanded to read from a server-rendered Context populated
 * once at the dashboard layout. Keep the call site stable so callers do not
 * change.
 */
export function useFlag(name: FeatureFlag): boolean {
  return getFlag(name);
}
