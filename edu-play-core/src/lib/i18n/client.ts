'use client'

import i18next, { type i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  NAMESPACES,
  type Language,
  type Namespace,
} from './config'

type InitResources = Partial<Record<Language, Partial<Record<Namespace, unknown>>>>

let initializedInstance: I18nInstance | null = null

/**
 * Initialize i18next on the client. Idempotent — safe to call from every
 * top-level layout Client Boundary. Namespaces not included in `resources`
 * are loaded lazily from `/locales/{lng}/{ns}.json` by a tiny fetch backend.
 */
export function initI18nClient(
  lang: Language,
  resources: InitResources,
): I18nInstance {
  if (initializedInstance) {
    hydrateResources(initializedInstance, resources)
    return initializedInstance
  }

  const instance = i18next.createInstance()

  instance.use(initReactI18next).use(fetchBackend).init({
    lng: lang,
    fallbackLng: FALLBACK_LANGUAGE,
    defaultNS: 'common',
    ns: [...NAMESPACES],
    resources: resources as I18nInstance['options']['resources'],
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
    react: { useSuspense: false },
  })

  initializedInstance = instance
  return instance
}

export function syncI18nClient(
  instance: I18nInstance,
  lang: Language,
  resources: InitResources,
): void {
  hydrateResources(instance, resources)

  if (instance.language !== lang) {
    void instance.changeLanguage(lang)
  }
}

function hydrateResources(instance: I18nInstance, resources: InitResources) {
  for (const lang of Object.keys(resources) as Language[]) {
    const bundles = resources[lang]
    if (!bundles) continue
    for (const ns of Object.keys(bundles) as Namespace[]) {
      const bundle = bundles[ns]
      if (bundle && !instance.hasResourceBundle(lang, ns)) {
        instance.addResourceBundle(lang, ns, bundle, true, false)
      }
    }
  }
}

type BackendCallback = (
  err: Error | null,
  data: Record<string, unknown> | null,
) => void

/**
 * Minimal backend: fetches `/locales/{lng}/{ns}.json` from the public folder.
 * Avoids a dependency on `i18next-http-backend`. Falls back silently on error
 * so a missing EN file never breaks the UI — RO fallback takes over.
 */
const fetchBackend = {
  type: 'backend' as const,
  init() {
    /* noop */
  },
  read(lang: string, ns: string, callback: BackendCallback) {
    fetch(`/locales/${lang}/${ns}.json`)
      .then((res) => {
        if (!res.ok) {
          callback(null, {})
          return
        }
        return res.json().then((data) => callback(null, data))
      })
      .catch(() => callback(null, {}))
  },
  create() {
    /* noop: we never POST translations */
  },
}

