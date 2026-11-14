import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { camelCaseKeys } from '@/lib/api/transform'

import type { ListenTapWordList } from '../types'

export async function getTeacherListenTapWordLists(
  supabase: SupabaseClient,
  teacherId: string,
): Promise<ListenTapWordList[]> {
  const { data, error } = await supabase
    .from('listen_tap_word_lists')
    .select('*')
    .eq('owner_teacher_id', teacherId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load word lists: ${error.message}`)
  }

  return (data ?? []).map((row) => camelCaseKeys(row) as ListenTapWordList)
}

export async function getTeacherListenTapWordList(
  supabase: SupabaseClient,
  teacherId: string,
  listId: string,
): Promise<ListenTapWordList | null> {
  const { data, error } = await supabase
    .from('listen_tap_word_lists')
    .select('*')
    .eq('id', listId)
    .eq('owner_teacher_id', teacherId)
    .maybeSingle()

  // Treat any lookup failure (including malformed UUID → Postgres 22P02) as
  // not-found so the editor route can surface notFound() instead of a 500.
  if (error || !data) return null

  return camelCaseKeys(data) as ListenTapWordList
}
