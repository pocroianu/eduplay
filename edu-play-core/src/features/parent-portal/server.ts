// Parent Portal Feature - Server-Only Exports
// Only import from this file in Server Components, Server Actions, and Route Handlers
// NEVER import from this file in Client Components

// Server-only queries
export {
  getLinkedChildren,
  getChildProgressSummary,
  getRecentActivity,
  getNotifications,
  getUnreadNotificationCount,
  getChildConsents,
  type LinkedChildResult,
  type ProgressSummary,
  type ActivityItem,
} from './queries';

// Server Actions (already marked with 'use server')
export { linkParentToChild } from './actions/link-child';
export {
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './actions/mark-notification-read';

// Types
export type { GenerateInviteCodeInput, LinkChildInput } from './schemas';
