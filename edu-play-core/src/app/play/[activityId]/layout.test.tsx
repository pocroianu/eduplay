import { render, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServerLanguageMock = vi.fn();
const preloadNamespacesMock = vi.fn();
const getUserMock = vi.fn();
const getPreferencesMock = vi.fn();

vi.mock('@/lib/i18n/server', () => ({
  getServerLanguage: () => getServerLanguageMock(),
  preloadNamespaces: (...args: unknown[]) => preloadNamespacesMock(...args),
}));

vi.mock('@/lib/i18n/I18nProvider', () => ({
  I18nProvider: ({ lang, children }: { lang: string; children: ReactNode }) => (
    <div data-testid="play-i18n" data-lang={lang}>
      {children}
    </div>
  ),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: () => getUserMock() } }),
}));

vi.mock('@/features/student-profile', () => ({
  PreferencesProvider: ({
    initial,
    children,
  }: {
    initial: { reduced_motion: boolean };
    children: ReactNode;
  }) => (
    <div data-testid="play-prefs" data-reduced={String(initial.reduced_motion)}>
      {children}
    </div>
  ),
}));

vi.mock('@/features/student-profile/server', () => ({
  getPreferences: (...args: unknown[]) => getPreferencesMock(...args),
}));

describe('/play layout', () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    getPreferencesMock.mockReset();
  });

  it('forces Romanian resources for the kid-mode player chrome', async () => {
    getServerLanguageMock.mockResolvedValue('en');
    preloadNamespacesMock.mockResolvedValue({ ro: { common: {}, player: {} } });

    const { default: PlayLayout } = await import('./layout');
    const result = await PlayLayout({ children: <span>Copil</span> });

    render(result as ReactElement);

    expect(preloadNamespacesMock).toHaveBeenCalledWith('ro', ['common', 'player']);
    expect(screen.getByTestId('play-i18n')).toHaveAttribute('data-lang', 'ro');
    expect(screen.getByText('Copil')).toBeInTheDocument();
    expect(screen.queryByTestId('play-prefs')).not.toBeInTheDocument();
  });

  it('applies the signed-in student reduced-motion preference', async () => {
    preloadNamespacesMock.mockResolvedValue({ ro: { common: {}, player: {} } });
    getUserMock.mockResolvedValue({ data: { user: { id: 'student-1' } } });
    getPreferencesMock.mockResolvedValue({
      sound_enabled: true,
      reduced_motion: true,
      theme: 'auto',
    });

    const { default: PlayLayout } = await import('./layout');
    const result = await PlayLayout({ children: <span>Copil</span> });

    render(result as ReactElement);

    expect(getPreferencesMock).toHaveBeenCalledWith('student-1');
    expect(screen.getByTestId('play-prefs')).toHaveAttribute('data-reduced', 'true');
    expect(screen.getByText('Copil')).toBeInTheDocument();
  });
});
