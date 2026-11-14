import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { PreferencesProvider, usePreferences } from './PreferencesProvider';
import { DEFAULT_PREFERENCES } from '../schemas/preferences.schema';

function Probe() {
  const { preferences, setPreferences, reduceMotion, resolvedTheme } = usePreferences();
  return (
    <div>
      <span data-testid="theme">{preferences.theme}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <span data-testid="reduced-motion">{String(reduceMotion)}</span>
      <span data-testid="sound">{String(preferences.sound_enabled)}</span>
      <button
        type="button"
        onClick={() => setPreferences({ theme: 'dark' })}
        data-testid="go-dark"
      >
        Dark
      </button>
      <button
        type="button"
        onClick={() => setPreferences({ reduced_motion: true })}
        data-testid="go-reduce"
      >
        Reduce
      </button>
    </div>
  );
}

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_event: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    },
    removeEventListener: (_event: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    },
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;

  window.matchMedia = vi.fn().mockReturnValue(mql);
  return {
    update(prefers: boolean) {
      (mql as unknown as { matches: boolean }).matches = prefers;
      listeners.forEach((cb) => cb({ matches: prefers } as MediaQueryListEvent));
    },
  };
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('PreferencesProvider', () => {
  it('falls back to defaults when used outside the provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('theme')).toHaveTextContent(DEFAULT_PREFERENCES.theme);
    expect(screen.getByTestId('reduced-motion')).toHaveTextContent('false');
  });

  it('exposes the initial preferences and clears the data-theme attribute on auto', () => {
    mockMatchMedia(false);
    render(
      <PreferencesProvider initial={{ ...DEFAULT_PREFERENCES, theme: 'auto' }}>
        <Probe />
      </PreferencesProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
  });

  it('writes data-theme="dark" when explicit dark theme is set', () => {
    mockMatchMedia(false);
    const { getByTestId } = render(
      <PreferencesProvider initial={{ ...DEFAULT_PREFERENCES, theme: 'auto' }}>
        <Probe />
      </PreferencesProvider>,
    );

    act(() => {
      getByTestId('go-dark').click();
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
  });

  it('flips reduceMotion when toggled and propagates the new value', () => {
    mockMatchMedia(false);
    const { getByTestId } = render(
      <PreferencesProvider initial={{ ...DEFAULT_PREFERENCES, reduced_motion: false }}>
        <Probe />
      </PreferencesProvider>,
    );

    expect(screen.getByTestId('reduced-motion')).toHaveTextContent('false');
    act(() => {
      getByTestId('go-reduce').click();
    });
    expect(screen.getByTestId('reduced-motion')).toHaveTextContent('true');
  });

  it('updates resolvedTheme when the OS preference changes under auto theme', () => {
    const media = mockMatchMedia(false);
    render(
      <PreferencesProvider initial={{ ...DEFAULT_PREFERENCES, theme: 'auto' }}>
        <Probe />
      </PreferencesProvider>,
    );
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');

    act(() => {
      media.update(true);
    });

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
  });
});
