import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';

const MAX_REQUESTS_PER_HOUR = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Check if the given email has exceeded the password reset rate limit.
 * Allows up to 3 requests per hour per email address.
 *
 * Returns { allowed: true } if request can proceed,
 * or { allowed: false, remainingTime: minutes } if rate limited.
 */
export async function checkRateLimit(email: string): Promise<{
  allowed: boolean;
  remainingTime?: number;
}> {
  const supabase = createAdminClient();
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from('password_reset_requests')
    .select('created_at')
    .eq('email', email.toLowerCase())
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Rate limit check error:', error);
    // Fail open: allow the request if we can't check rate limits
    return { allowed: true };
  }

  const requestCount = data?.length || 0;

  if (requestCount >= MAX_REQUESTS_PER_HOUR) {
    // Calculate when the oldest request in the window will expire
    const mostRecentRequest = new Date(data![0].created_at!);
    const expiryTime = new Date(mostRecentRequest.getTime() + RATE_LIMIT_WINDOW_MS);
    const remainingMs = expiryTime.getTime() - Date.now();
    const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));

    return { allowed: false, remainingTime: remainingMinutes };
  }

  return { allowed: true };
}

/**
 * Log a password reset request to the database for rate limiting.
 * Called after every reset request, even for non-existent emails (security).
 */
export async function logResetRequest(
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from('password_reset_requests').insert({
    email: email.toLowerCase(),
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
  });

  if (error) {
    // Log but don't block the user flow
    console.error('Failed to log reset request:', error);
  }
}
