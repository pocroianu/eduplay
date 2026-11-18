import { z } from 'zod';
import {
  DEFAULT_PREFERENCES,
  type PreferencesFormData,
  type ThemeMode,
} from './preferences.defaults';

export const themeModeSchema = z.enum(['light', 'dark', 'auto']);

export const preferencesSchema = z.object({
  sound_enabled: z.boolean(),
  reduced_motion: z.boolean(),
  theme: themeModeSchema,
}) satisfies z.ZodType<PreferencesFormData>;

export { DEFAULT_PREFERENCES };
export type { PreferencesFormData, ThemeMode };
