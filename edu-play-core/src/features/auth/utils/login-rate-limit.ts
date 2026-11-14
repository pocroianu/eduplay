import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Database-backed login rate limiter.
 *
 * Tracks failed login attempts per identifier (email or student username key).
 * After MAX_ATTEMPTS failures within WINDOW_MS, further attempts are blocked.
 *
 * This is especially important for student PIN auth where the keyspace is only
 * 10,000 possible 4-digit PINs. The limiter uses the service-role client so it
 * remains shared across server instances. If the limiter storage is unavailable,
 * it fails open per the project security posture.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_TABLE = 'auth_rate_limit_events';

export interface LoginRateLimitResult {
  allowed: boolean;
  remainingAttempts?: number;
  retryAfterMinutes?: number;
}

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function windowStartIso(now = Date.now()): string {
  return new Date(now - WINDOW_MS).toISOString();
}

/**
 * Check if a login attempt is allowed for the given identifier.
 */
export async function checkLoginRateLimit(
  identifier: string,
): Promise<LoginRateLimitResult> {
  const key = normalizeIdentifier(identifier);
  if (!key) return { allowed: true, remainingAttempts: MAX_ATTEMPTS };

  try {
    const now = Date.now();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(RATE_LIMIT_TABLE)
      .select('created_at')
      .eq('identifier', key)
      .gte('created_at', windowStartIso(now))
      .order('created_at', { ascending: false })
      .limit(MAX_ATTEMPTS);

    if (error) {
      console.error('Login rate limit check error:', error.message);
      return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
    }

    const attempts = data ?? [];
    if (attempts.length >= MAX_ATTEMPTS) {
      const oldestAttempt = attempts[attempts.length - 1];
      const oldestCreatedAt = oldestAttempt?.created_at
        ? new Date(oldestAttempt.created_at).getTime()
        : now;
      const remainingMs = WINDOW_MS - (now - oldestCreatedAt);
      const retryAfterMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
      return { allowed: false, retryAfterMinutes };
    }

    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - attempts.length };
  } catch (error) {
    console.error('Login rate limit check failed:', error);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }
}

/**
 * Record a failed login attempt for the given identifier.
 */
export async function recordFailedLogin(identifier: string): Promise<void> {
  const key = normalizeIdentifier(identifier);
  if (!key) return;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from(RATE_LIMIT_TABLE).insert({
      identifier: key,
    });

    if (error) {
      console.error('Login rate limit record error:', error.message);
      return;
    }

    await supabase
      .from(RATE_LIMIT_TABLE)
      .delete()
      .eq('identifier', key)
      .lt('created_at', windowStartIso());
  } catch (error) {
    console.error('Login rate limit record failed:', error);
  }
}

/**
 * Clear failed login attempts after a successful login.
 */
export async function clearLoginAttempts(identifier: string): Promise<void> {
  const key = normalizeIdentifier(identifier);
  if (!key) return;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from(RATE_LIMIT_TABLE)
      .delete()
      .eq('identifier', key);

    if (error) {
      console.error('Login rate limit clear error:', error.message);
    }
  } catch (error) {
    console.error('Login rate limit clear failed:', error);
  }
}
