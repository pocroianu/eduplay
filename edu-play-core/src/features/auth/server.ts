// Auth Feature - Server-Only Exports
// Only import from this file in Server Components, Server Actions, and Route Handlers
// NEVER import from this file in Client Components

// Server-only utilities (import directly from source, not through barrel)
export { checkRateLimit, logResetRequest } from './utils/check-rate-limit';
export { studentPinToAuthPassword } from './utils/student-auth-password';

// Types (safe to export as they're compile-time only)
export type { RequestPasswordResetResult } from './actions/request-password-reset';
export type { ResetPasswordResult } from './actions/reset-password';
