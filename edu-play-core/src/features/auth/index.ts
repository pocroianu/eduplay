// Components
export {
  AuthInput,
  AuthButton,
  AuthInlineLink,
  LoginForm,
  RegisterForm,
  StudentPinPad,
  StudentLoginShell,
  ParentLoginForm,
  ParentRegisterForm,
  ForgotPasswordForm,
  ResetPasswordForm,
  ResetPasswordError,
  PasswordStrengthIndicator,
} from './components';

// Actions
export { logout } from './actions/logout';

// Schemas
export {
  resetPasswordSchema,
  passwordRequirementChecks,
  passwordRequirementLabels,
} from './schemas/reset-password.schema';

// Utils
// NOTE: checkRateLimit and logResetRequest moved to ./server.ts

// Types
export type {
  LoginFormData,
  RegisterFormData,
  StudentLoginFormData,
  ParentLoginFormData,
  ParentRegisterFormData,
} from './types';
export type { ForgotPasswordFormData } from './schemas/forgot-password.schema';
export type { ResetPasswordFormData } from './schemas/reset-password.schema';
export type { PasswordStrength, PasswordStrengthResult } from './utils';
export type { RequestPasswordResetResult } from './actions/request-password-reset';
export type { ResetPasswordResult } from './actions/reset-password';
