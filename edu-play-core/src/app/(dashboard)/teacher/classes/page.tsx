import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClassesPageContent } from '@/features/teacher-dashboard'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server'
import { ROUTES } from '@/shared/lib/constants'

export default async function ClassesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  // Get student counts for each class
  const classIds = classes?.map(c => c.id) || []
  const { data: studentCounts } = await supabase
    .from('students')
    .select('class_id')
    .in('class_id', classIds.length > 0 ? classIds : ['00000000-0000-0000-0000-000000000000'])

  const countByClass = studentCounts?.reduce((acc, s) => {
    if (s.class_id) {
      acc[s.class_id] = (acc[s.class_id] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>) || {}

  const lang = await getServerLanguage()
  const resources = await preloadNamespaces(lang, ['teacher'])

  return (
    <I18nProvider lang={lang} resources={resources}>
      <ClassesPageContent
        profile={{
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          role: profile.role,
          avatar_url: profile.avatar_url,
        }}
        classes={classes || []}
        countByClass={countByClass}
      />
    </I18nProvider>
  )
}
