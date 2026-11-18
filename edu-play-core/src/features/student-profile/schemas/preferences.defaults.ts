// Zod-free preference types and defaults. Client components that only need the
// defaults (e.g. `PreferencesProvider`, mounted in the student layout) import
// from here so the zod runtime stays out of first-load JS.

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface PreferencesFormData {
  sound_enabled: boolean;
  reduced_motion: boolean;
  theme: ThemeMode;
}

export const DEFAULT_PREFERENCES: PreferencesFormData = {
  sound_enabled: true,
  reduced_motion: false,
  theme: 'auto',
};
