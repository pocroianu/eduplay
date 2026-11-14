'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/server'
import { ROUTES } from '@/shared/lib/constants'
import { getTeacherActivityContext } from './teacher-context'
import type { ArchiveTeacherActivityResult } from '../types'

function errorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : null
  if (code === '42501') return 'Nu ai dreptul să arhivezi această activitate.'
  if (code === 'P0002') return 'Nu am găsit activitatea.'
  return 'Nu am putut arhiva activitatea. Încearcă din nou.'
}

export async function archiveTeacherActivity(activityId: string): Promise<ArchiveTeacherActivityResult> {
  if (!activityId) return { success: false, error: 'Activitatea lipsește.' }

  const auth = await getTeacherActivityContext()
  if (!auth) return { success: false, error: 'Nu ești autentificat ca profesor.' }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('archive_teacher_activity_atomically', {
    p_activity_id: activityId,
    p_actor_id: auth.userId,
  })

  if (error || !data) {
    console.error('archiveTeacherActivity RPC error:', error)
    return { success: false, error: errorMessage(error) }
  }

  const archivedId = (data as { activity?: { id?: string } }).activity?.id ?? activityId
  revalidatePath(ROUTES.TEACHER.ACTIVITIES)
  revalidatePath(ROUTES.TEACHER.ASSIGNMENT_NEW)

  return { success: true, data: { activityId: archivedId } }
}
