/**
 * Stable, locale-independent prefix the client uses to detect a rate-limit
 * lockout without parsing the human-readable error copy. Format:
 *   STUDENT_LOGIN_RATE_LIMITED:<retryAfterMinutes>
 */
export const STUDENT_LOGIN_RATE_LIMITED_CODE = 'STUDENT_LOGIN_RATE_LIMITED';

export function isStudentLoginRateLimited(message: string): boolean {
  return message.startsWith(`${STUDENT_LOGIN_RATE_LIMITED_CODE}:`);
}
