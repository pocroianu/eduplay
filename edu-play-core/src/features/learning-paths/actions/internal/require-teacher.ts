// Internal helper shared by every learning-paths server action.
// Kept outside any `'use server'` file so the indirection isn't exposed
// as a public RPC endpoint — only the wrapping action is.

import 'server-only';
import { ApiError, requireRole, type AuthContext } from '@/lib/api';
import type { ActionResult } from '../../types';

/**
 * Wraps `requireRole('teacher','admin')` so callers get a Pattern-B
 * `ActionResult` failure with Romanian copy instead of an exception.
 *
 * Returns either `{ ok: true, ctx }` (caller should proceed) or
 * `{ ok: false, error }` (caller should return the action result directly).
 */
export async function requireTeacher(): Promise<
  | { ok: true; ctx: AuthContext }
  | { ok: false; error: ActionResult<never> }
> {
  try {
    const ctx = await requireRole('teacher', 'admin');
    return { ok: true, ctx };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        ok: false,
        error: {
          success: false,
          error:
            err.code === 'FORBIDDEN'
              ? 'Nu ai permisiunea pentru această acțiune'
              : 'Nu ești autentificat',
        },
      };
    }
    throw err;
  }
}
