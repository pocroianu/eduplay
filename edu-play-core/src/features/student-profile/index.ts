// Components
export {
  StudentProfileContent,
  AvatarPickerDialog,
  ChangePinDialog,
  PreferencesProvider,
  usePreferences,
} from './components';
export type {
  StudentProfileContentProps,
  AvatarPickerDialogProps,
  ChangePinDialogProps,
  PreferencesProviderProps,
} from './components';

// Schemas
export {
  preferencesSchema,
  themeModeSchema,
  DEFAULT_PREFERENCES,
} from './schemas/preferences.schema';
export type { PreferencesFormData, ThemeMode } from './schemas/preferences.schema';

export type { ChangePinFormData } from './schemas/pin.schema';

export type { AvatarPreset, UpdateAvatarFormData } from './schemas/avatar.schema';

// Server actions
export {
  updateAvatarAction,
  updatePreferencesAction,
  changePinAction,
} from './actions';
export type {
  UpdateAvatarResult,
  UpdatePreferencesResult,
  ChangePinResult,
} from './actions';
