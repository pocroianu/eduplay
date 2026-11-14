import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server'
import { LanguageSwitcher } from '@/shared/components/i18n/LanguageSwitcher'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const lang = await getServerLanguage()
  const resources = await preloadNamespaces(lang, ['auth'])

  return (
    <I18nProvider lang={lang} resources={resources}>
      <div className="relative min-h-screen">
        <div className="pointer-events-none absolute right-4 top-4 z-20 md:right-6 md:top-6">
          <div className="pointer-events-auto">
            <LanguageSwitcher size="sm" tone="onSurface" />
          </div>
        </div>
        {children}
      </div>
    </I18nProvider>
  )
}
