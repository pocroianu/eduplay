import Link from 'next/link'
import { redirect } from 'next/navigation'

import { TeacherReviewQueue } from '@/features/teacher-activities'
import { getTeacherReviewQueue } from '@/features/teacher-activities/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/shared/lib/constants'
import { Icon } from '@/shared/components/ui/Icon'

export default async function TeacherActivityReviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const [items, lang] = await Promise.all([
    getTeacherReviewQueue(supabase, user.id),
    getServerLanguage(),
  ])
  const resources = await preloadNamespaces(lang, ['teacher'])

  return (
    <I18nProvider lang={lang} resources={resources}>
      <main className="p-6 lg:p-10">
        <div className="mx-auto max-w-[1440px] space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-soft lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Link
                href={ROUTES.TEACHER.ACTIVITIES}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
              >
                <Icon name="ArrowLeft" size={16} aria-hidden />
                Activități
              </Link>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-deep">
                  Coada profesorului
                </p>
                <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">
                  Verifică răspunsuri
                </h1>
                <p className="max-w-2xl text-sm font-semibold leading-6 text-on-surface-variant">
                  Aprobă răspunsurile libere trimise sau cere o revizuire cu feedback scurt pentru elev.
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-primary-soft px-4 py-3 text-sm font-bold text-primary-deep">
              {items.length === 1 ? '1 răspuns de verificat' : `${items.length} răspunsuri de verificat`}
            </div>
          </div>

          <TeacherReviewQueue items={items} />
        </div>
      </main>
    </I18nProvider>
  )
}
