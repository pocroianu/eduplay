import 'server-only'

import { createClient } from '@/lib/supabase/server'

export async function getTeacherActivityContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') return null
  return { supabase, userId: user.id }
}
