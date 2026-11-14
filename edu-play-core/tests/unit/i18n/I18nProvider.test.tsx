import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/i18n/actions/switch-language', () => ({
  switchLanguage: vi.fn(),
}))

import { useTranslation } from 'react-i18next'

import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { LanguageSwitcher } from '@/shared/components/i18n/LanguageSwitcher'

const resources = {
  ro: {
    common: {
      language: { switcher: 'Schimbă limba' },
    },
    player: {
      actions: { backToGames: 'Înapoi la jocuri' },
    },
  },
  en: {
    common: {
      language: { switcher: 'Switch language' },
    },
    player: {
      actions: { backToGames: 'Back to games' },
    },
  },
}

function PlayerLabel() {
  const { t } = useTranslation('player')
  return <div>{t('actions.backToGames')}</div>
}

describe('I18nProvider', () => {
  it('hydrates new namespaces before the first client render', () => {
    const view = render(
      <I18nProvider lang="ro" resources={{ ro: { common: resources.ro.common } }}>
        <div>root</div>
      </I18nProvider>,
    )

    view.rerender(
      <I18nProvider lang="ro" resources={{ ro: { common: resources.ro.common } }}>
        <I18nProvider lang="ro" resources={resources}>
          <PlayerLabel />
        </I18nProvider>
      </I18nProvider>,
    )

    expect(view.getByText('Înapoi la jocuri')).toBeInTheDocument()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not notify subscribed language controls while another provider is rendering', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const view = render(
      <MantineProvider>
        <I18nProvider lang="ro" resources={resources}>
          <LanguageSwitcher />
        </I18nProvider>
      </MantineProvider>,
    )

    view.rerender(
      <MantineProvider>
        <I18nProvider lang="ro" resources={resources}>
          <LanguageSwitcher />
          <I18nProvider lang="en" resources={resources}>
            <div>nested route</div>
          </I18nProvider>
        </I18nProvider>
      </MantineProvider>,
    )

    expect(consoleError.mock.calls.flat().join('\n')).not.toContain(
      'Cannot update a component',
    )
  })
})
