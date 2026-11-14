import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const switchLanguageMock = vi.fn()

vi.mock('@/features/i18n/actions/switch-language', () => ({
  switchLanguage: (...args: unknown[]) => switchLanguageMock(...args),
}))

import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { initI18nClient } from '@/lib/i18n/client'
import { LanguageSwitcher } from './LanguageSwitcher'

const resources = {
  ro: {
    common: {
      language: { switcher: 'Schimbă limba' },
    },
  },
  en: {
    common: {
      language: { switcher: 'Switch language' },
    },
  },
} as const

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('LanguageSwitcher', () => {
  const renderSwitcher = () =>
    render(
      <MantineProvider>
        <I18nProvider lang="ro" resources={resources}>
          <LanguageSwitcher />
        </I18nProvider>
      </MantineProvider>,
    )

  const getSwitcherButton = () =>
    within(screen.getByTestId('language-switcher')).getByRole('button', {
      name: /schimbă limba|switch language/i,
    })

  const selectLanguage = async (label: RegExp) => {
    const user = userEvent.setup()

    await user.click(getSwitcherButton())
    await user.click(await screen.findByRole('option', { name: label, hidden: true }))
  }

  beforeEach(async () => {
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: TestResizeObserver,
    })
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: TestResizeObserver,
    })
    switchLanguageMock.mockReset()
    await initI18nClient('ro', resources).changeLanguage('ro')
  })

  it('renders an accessible control with the current language preselected', () => {
    renderSwitcher()

    const control = getSwitcherButton()

    expect(control).toHaveTextContent(/RO.*Română/)
    expect(screen.getByLabelText('Schimbă limba')).toBe(control)
  })

  it('optimistically swaps the client language and persists via the server action', async () => {
    switchLanguageMock.mockResolvedValue({ ok: true, lang: 'en' })

    renderSwitcher()

    await selectLanguage(/EN.*English/i)

    await waitFor(() => {
      expect(switchLanguageMock).toHaveBeenCalledWith('en')
    })
  })

  it('rolls the client language back when the server rejects the change', async () => {
    switchLanguageMock.mockResolvedValue({ ok: false, error: 'unsupported-language' })

    renderSwitcher()

    await selectLanguage(/EN.*English/i)

    await waitFor(() => {
      expect(getSwitcherButton()).toHaveTextContent(/RO.*Română/)
    })
  })

  it('is a noop when the selected language matches the current one', async () => {
    renderSwitcher()

    await selectLanguage(/RO.*Română/i)

    expect(switchLanguageMock).not.toHaveBeenCalled()
  })
})
