// Parent Portal Server Actions
// Export all server actions from this file (barrel export pattern)

export {
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './mark-notification-read';
export {
  setChildConsent,
  type SetChildConsentInput,
  type SetChildConsentResult,
} from './set-child-consent';
