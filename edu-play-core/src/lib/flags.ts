import type { FeatureFlag, TargetingRules } from '@/features/admin/api/schemas';

export interface FlagEvaluationProfile {
  id: string;
  role: string;
}

/**
 * Pure evaluation: deny → allow → roles → enabled.
 *
 * - `deny` always wins (returns false even if allow/roles match).
 * - `allow` short-circuits to true when the user id is listed.
 * - `roles` (when set) requires the profile role to be included.
 * - With no allow/roles configured, the flag follows `enabled`.
 */
export function evaluateFlag(
  flag: Pick<FeatureFlag, 'enabled' | 'targeting'>,
  profile: FlagEvaluationProfile,
): boolean {
  const targeting: TargetingRules = flag.targeting ?? {};

  if (targeting.deny?.includes(profile.id)) {
    return false;
  }

  if (targeting.allow?.includes(profile.id)) {
    return true;
  }

  if (targeting.roles && targeting.roles.length > 0) {
    if (!(targeting.roles as readonly string[]).includes(profile.role)) {
      return false;
    }
  }

  return flag.enabled;
}
