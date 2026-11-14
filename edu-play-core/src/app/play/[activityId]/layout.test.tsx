import { render, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const getServerLanguageMock = vi.fn();
const preloadNamespacesMock = vi.fn();

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

describe('/play layout', () => {
  it('forces Romanian resources for the kid-mode player chrome', async () => {
    getServerLanguageMock.mockResolvedValue('en');
    preloadNamespacesMock.mockResolvedValue({ ro: { common: {}, player: {} } });

    const { default: PlayLayout } = await import('./layout');
    const result = await PlayLayout({ children: <span>Copil</span> });

    render(result as ReactElement);

    expect(preloadNamespacesMock).toHaveBeenCalledWith('ro', ['common', 'player']);
    expect(screen.getByTestId('play-i18n')).toHaveAttribute('data-lang', 'ro');
    expect(screen.getByText('Copil')).toBeInTheDocument();
  });
});
