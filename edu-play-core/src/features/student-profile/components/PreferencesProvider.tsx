'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { MotionConfig } from 'framer-motion';
import {
  DEFAULT_PREFERENCES,
  type PreferencesFormData,
  type ThemeMode,
} from '../schemas/preferences.defaults';

interface PreferencesContextValue {
  preferences: PreferencesFormData;
  setPreferences: (next: Partial<PreferencesFormData>) => void;
  reduceMotion: boolean;
  resolvedTheme: 'light' | 'dark';
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export interface PreferencesProviderProps {
  initial: PreferencesFormData;
  children: ReactNode;
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeToColorScheme(notify: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * Wires student preferences through React context + framer-motion's
 * `MotionConfig`. Setting `reduced_motion: true` flips MotionConfig to
 * `reducedMotion="always"` so every framer animation in the tree is bypassed
 * without each component needing its own `useReducedMotion()` guard. When
 * the toggle is off we still respect the OS-level preference via
 * `reducedMotion="user"`.
 *
 * Theme persists via the `data-theme` attribute on `<html>` so Tailwind's
 * `dark:` selector can react instantly. `auto` clears the attribute and
 * falls back to the user's OS color scheme — `useSyncExternalStore` keeps
 * the preview in sync without a setState-in-effect cascade.
 */
export function PreferencesProvider({ initial, children }: PreferencesProviderProps) {
  const [preferences, setPreferencesState] = useState<PreferencesFormData>(() => initial);
  const systemPrefersDark = useSyncExternalStore(
    subscribeToColorScheme,
    getSystemPrefersDark,
    () => false,
  );

  const resolvedTheme: 'light' | 'dark' =
    preferences.theme === 'auto'
      ? systemPrefersDark
        ? 'dark'
        : 'light'
      : preferences.theme;

  // Reflect the active theme on <html data-theme>. No setState here, so the
  // react-hooks rule against setState-in-effect stays happy.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (preferences.theme === 'auto') {
      root.removeAttribute('data-theme');
      return;
    }
    root.setAttribute('data-theme', preferences.theme);
  }, [preferences.theme]);

  const setPreferences = useCallback((next: Partial<PreferencesFormData>) => {
    setPreferencesState((prev) => ({ ...prev, ...next }));
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      setPreferences,
      reduceMotion: preferences.reduced_motion,
      resolvedTheme,
    }),
    [preferences, setPreferences, resolvedTheme],
  );

  return (
    <PreferencesContext.Provider value={value}>
      <MotionConfig reducedMotion={preferences.reduced_motion ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    // Outside a provider (e.g. teacher routes) — fall back to defaults so
    // shared components don't have to guard.
    return {
      preferences: DEFAULT_PREFERENCES,
      setPreferences: () => {},
      reduceMotion: false,
      resolvedTheme: 'light',
    };
  }
  return ctx;
}

export type { ThemeMode };
