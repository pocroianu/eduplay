'use client'

import { useTransition } from 'react'
import { useTranslation } from 'react-i18next'

import { switchLanguage } from '@/features/i18n/actions/switch-language'
import { FilterSelect } from '@/shared/components/ui/kit'
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  type Language,
} from '@/lib/i18n/config'

type LanguageSwitcherTone = 'onSurface' | 'onSurfaceVariant' | 'inverse'

interface LanguageSwitcherProps {
  /**
   * Visual tone. `onSurface` is the default used inside dashboards; `inverse`
   * is used on marketing/landing where the chrome sits on a tinted surface.
   */
  tone?: LanguageSwitcherTone
  /**
   * Render a compact pill (for in-app chrome) vs. a labeled chip (for
   * pre-auth footers). Both variants remain accessible; the label is always
   * exposed to screen readers.
   */
  size?: 'sm' | 'md'
  className?: string
}

const TONE_CLASSES: Record<LanguageSwitcherTone, string> = {
  onSurface:
    'text-on-surface bg-surface-container hover:bg-surface-container-high',
  onSurfaceVariant:
    'text-on-surface-variant bg-transparent hover:bg-surface-container',
  inverse:
    'text-on-primary bg-primary/10 hover:bg-primary/20',
}

export function LanguageSwitcher({
  tone = 'onSurfaceVariant',
  size = 'sm',
  className,
}: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation('common')
  const [isPending, startTransition] = useTransition()

  const currentLanguage = (i18n.language?.slice(0, 2) ?? 'ro') as Language

  function handleChange(nextLang: string) {
    if (!isSupportedLanguage(nextLang) || nextLang === currentLanguage) {
      return
    }

    void i18n.changeLanguage(nextLang)

    startTransition(async () => {
      const result = await switchLanguage(nextLang)
      if (!result.ok) {
        void i18n.changeLanguage(currentLanguage)
      }
    })
  }

  return (
    <FilterSelect
      ariaLabel={t('language.switcher')}
      value={currentLanguage}
      onChange={handleChange}
      disabled={isPending}
      options={SUPPORTED_LANGUAGES.map((lang) => ({
        value: lang,
        label: `${lang.toUpperCase()} · ${LANGUAGE_LABELS[lang]}`,
      }))}
      size={size === 'md' ? 'sm' : 'xs'}
      radius="xl"
      width={size === 'md' ? 156 : 132}
      className={className}
      classNames={{ input: TONE_CLASSES[tone] }}
      data-testid="language-switcher"
    />
  )
}
