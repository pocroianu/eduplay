// Activities Feature - Server-Only Exports
// Only import from this file in Server Components, Server Actions, and
// Route Handlers. NEVER import from this file in Client Components.
export { getActivityStreak } from './progress/get-activity-streak';
export { resolveActivityLaunch } from './server/resolve-activity-launch';

export { getActivityInstance, getStudentActivities } from './queries';
export {
  ACTIVITY_INSTANCE_SELECT,
  type ActivityInstanceRow,
} from './queries';
export {
  parseConfigOrThrow,
  validateConfig,
  type ConfigValidationError,
  type ValidateConfigResult,
} from './server/validate-config';
export {
  buildPreviewToken,
  cleanupExpiredPreviewSessions,
  createPreviewSession,
  createActivityVersion,
  getActivityOrThrow,
  getActivityTypeOrThrow,
  getLatestActivityVersion,
  getPreviewSessionOrThrow,
  parseActivityRowFromDb,
  parseActivityTypeRowFromDb,
  parseActivityVersionRowFromDb,
  snakeCaseColumns,
  updateActivityPublishState,
  validateConfigForType,
  verifyPreviewToken,
  versionMatchesDraft,
} from './server/cms-api';
export type { ActivityPreviewSession, PreviewTokenPayload } from './server/cms-api';
export {
  attachPinnedActivityIds,
} from './server/assignment-launch';
export {
  resolveLatestPublishedActivityAssignmentTarget,
} from './server/assignment-version-pin';
export type {
  ActivityAssignmentTarget,
  ActivityVersionPin,
} from './server/assignment-version-pin';

export { getActivityProgress } from './progress/get-activity-progress';
export { summarizeActivityProgress } from './progress/activity-progress';
