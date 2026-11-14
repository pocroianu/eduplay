// Parent Portal Zod Schemas
// Export all validation schemas from this file (barrel export pattern)

export {
  generateInviteCodeSchema,
  type GenerateInviteCodeInput,
  type GenerateInviteCodeResult,
} from './invite-code.schema';

export {
  linkChildSchema,
  type LinkChildInput,
  type LinkChildResult,
} from './link-child.schema';

// Note: Schemas to be added in Phase 3-4
// export { notificationPreferencesSchema } from './notification-preferences.schema';
