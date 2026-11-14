import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { WordListPreviewContent } from '@/features/teacher-dashboard/listen-tap'
import { getTeacherListenTapWordList } from '@/features/teacher-dashboard/listen-tap/server'
import { ROUTES } from '@/shared/lib/constants'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TeacherListenTapPreviewPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const wordList = await getTeacherListenTapWordList(supabase, user.id, id)
  if (!wordList) {
    notFound()
  }

  return (
    <WordListPreviewContent
      wordListId={wordList.id}
      wordListName={wordList.name}
      wordListLanguage={wordList.language}
    />
  )
}
