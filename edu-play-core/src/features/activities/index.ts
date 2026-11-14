// Activities Feature Module - Public API
// Client-safe exports only. Query functions live in `./server` per
// CLAUDE.md § Server/Client Code Separation.

// Side-effect import: registers every shipped F9 activity type with the
// in-memory registry. Importing the activities barrel (server- or
// client-side) is enough to make `getActivityType('drawing-canvas')` etc.
// resolve.
import './types/registrations';

// Types
export type {
  ActivityInstance,
  ActivityRendererProps,
  ActivityTypeDefinition,
  ActionResult,
  ConfigInput,
  ConfigOf,
  ConsentKey,
  ConsentMap,
  GateDeniedReason,
  GateResult,
  RecordArtifactInput,
  ResultOf,
  StudentActivityContext,
} from './types';

// Schemas (Zod schemas are isomorphic — safe to import from client forms).
export {
  createActivityInstanceSchema,
  activityInstanceIdSchema,
  type CreateActivityInstanceInput,
  type ActivityInstanceIdInput,
} from './schemas';

// Runtime constants
export { CONSENT_KEYS } from './types';

// Registry (code-side catalog of activity types).
export {
  registerActivityType,
  getActivityType,
  listActivityTypes,
} from './registry';

// Pure helpers (server- and client-safe).
export { resolveConsentGate } from './lib/consent-gate';
export { getAssignmentActivityPlayHref } from './assignment-launch';
export type { AssignmentActivityLaunchRow } from './assignment-launch';

// Server Actions
export {
  assignActivity,
  type AssignActivityData,
  type AssignActivityInput,
} from './actions';

// Components
export { ActivityPlayer, FreeResponsePlayContent, type ActivityPlayerProps } from './components';

