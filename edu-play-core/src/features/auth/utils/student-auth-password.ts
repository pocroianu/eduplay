const STUDENT_AUTH_PASSWORD_PREFIX = 'student-pin:';

/**
 * Supabase Auth enforces a password length longer than our child-facing
 * 4-digit PINs. Keep the public credential as the PIN and derive the internal
 * Auth password consistently at both seed and login boundaries.
 */
export function studentPinToAuthPassword(pin: string): string {
  return `${STUDENT_AUTH_PASSWORD_PREFIX}${pin}`;
}
