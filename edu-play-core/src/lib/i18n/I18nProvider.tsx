'use client'

import { useEffect, useState } from 'react'
import { I18nextProvider } from 'react-i18next'

import { initI18nClient, syncI18nClient } from './client'
import type { Language, Namespace } from './config'

interface I18nProviderProps {
  lang: Language
  resources: Partial<Record<Language, Partial<Record<Namespace, unknown>>>>
  children: React.ReactNode
}

export function I18nProvider({ lang, resources, children }: I18nProviderProps) {
  const [instance] = useState(() => initI18nClient(lang, resources))

  useEffect(() => {
    syncI18nClient(instance, lang, resources)
  }, [instance, lang, resources])

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>
}
