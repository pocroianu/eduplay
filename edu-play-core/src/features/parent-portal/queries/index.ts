// Parent Portal Queries
// Export all query functions from this file (barrel export pattern)

// ----- Query Return Types -----
export type {
  ActivityItem,
  ActivityItemKind,
  ArtifactActivityItem,
  GameProgressActivityItem,
  LinkedChildResult,
  ProgressSummary,
} from './types';

// ----- Query Exports -----
// Wrapped with React cache() to deduplicate calls within the same server
// render pass (e.g., layout.tsx and page.tsx both calling getLinkedChildren).

import { cache } from 'react';
import { getLinkedChildren as _getLinkedChildren } from './get-linked-children';
import { getChildProgressSummary as _getChildProgressSummary } from './get-child-progress-summary';
import { getRecentActivity as _getRecentActivity } from './get-recent-activity';

export const getLinkedChildren = cache(_getLinkedChildren);
export const getChildProgressSummary = cache(_getChildProgressSummary);
export const getRecentActivity = cache(_getRecentActivity);

import { getNotifications as _getNotifications } from './get-notifications';
import { getUnreadNotificationCount as _getUnreadNotificationCount } from './get-unread-notification-count';

export const getNotifications = cache(_getNotifications);
export const getUnreadNotificationCount = cache(_getUnreadNotificationCount);

import { getChildConsents as _getChildConsents } from './get-child-consents';

export const getChildConsents = cache(_getChildConsents);
