import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { preloadNamespaces } from '@/lib/i18n/server'

export default async function PlayLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const resources = await preloadNamespaces('ro', ['common', 'player'])

  return (
    <I18nProvider lang="ro" resources={resources}>
      {children}
    </I18nProvider>
  )
}
