import { z } from 'zod';

export const themeModeSchema = z.enum(['light', 'dark', 'auto']);

export type ThemeMode = z.infer<typeof themeModeSchema>;

export const preferencesSchema = z.object({
  sound_enabled: z.boolean(),
  reduced_motion: z.boolean(),
  theme: themeModeSchema,
});

export type PreferencesFormData = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: PreferencesFormData = {
  sound_enabled: true,
  reduced_motion: false,
  theme: 'auto',
};
