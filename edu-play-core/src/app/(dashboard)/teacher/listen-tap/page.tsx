import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { WordListsPageContent } from '@/features/teacher-dashboard/listen-tap'
import { getTeacherListenTapWordLists } from '@/features/teacher-dashboard/listen-tap/server'
import { ROUTES } from '@/shared/lib/constants'

export default async function TeacherListenTapPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const wordLists = await getTeacherListenTapWordLists(supabase, user.id)

  return (
    <WordListsPageContent
      profile={{
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
      }}
      initialWordLists={wordLists}
    />
  )
}
