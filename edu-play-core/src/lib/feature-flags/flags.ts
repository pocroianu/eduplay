/**
 * Env-var-backed feature flag layer (v1).
 *
 * Source of truth: a static list of declared flags below. Each flag maps to a
 * specific NEXT_PUBLIC_* env var. Values are inlined by Next.js at build time,
 * so the same `getFlag(name)` call works on both server and client.
 *
 * Test seam: `getFlag` reads `process.env.NEXT_PUBLIC_*` via a switch on the
 * flag name (not a dynamic indexer) so Next.js can statically inline the
 * lookup. Tests use `vi.stubEnv` to swap values between cases.
 *
 * v1 scope: env-var only. A database-backed runtime flag system (admin-flippable)
 * is a separate ticket and lives behind the admin API in `src/lib/flags.ts`.
 */

export const FEATURE_FLAGS = ['listen_tap_audio'] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export type FeatureFlagSnapshot = Record<FeatureFlag, boolean>;

function readRawValue(name: FeatureFlag): string | undefined {
  switch (name) {
    case 'listen_tap_audio':
      return process.env.NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO;
  }
}

function parseFlagValue(raw: string | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim().toLowerCase();
  return trimmed === '1' || trimmed === 'true' || trimmed === 'on';
}

export function getFlag(name: FeatureFlag): boolean {
  return parseFlagValue(readRawValue(name));
}

export function getFlagSnapshot(): FeatureFlagSnapshot {
  return FEATURE_FLAGS.reduce((acc, name) => {
    acc[name] = getFlag(name);
    return acc;
  }, {} as FeatureFlagSnapshot);
}
