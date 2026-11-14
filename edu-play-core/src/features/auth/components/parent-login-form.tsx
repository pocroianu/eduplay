'use client';

import { LoginForm } from './login-form';

/**
 * Parent login uses the same schema and action as teacher login. The component
 * is kept as a thin wrapper so tests + callers can still distinguish the role.
 */
export function ParentLoginForm() {
  return <LoginForm idPrefix="parent" />;
}
