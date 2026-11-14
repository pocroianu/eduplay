'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/server'
import { ROUTES } from '@/shared/lib/constants'
import { getTeacherActivityContext } from './teacher-context'
import type { DuplicateTeacherActivityResult } from '../types'

function errorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : null
  if (code === '42501') return 'Nu ai dreptul să duplici această activitate.'
  if (code === 'P0002') return 'Nu am găsit activitatea.'
  return 'Nu am putut duplica activitatea. Încearcă din nou.'
}

export async function duplicateTeacherActivity(activityId: string): Promise<DuplicateTeacherActivityResult> {
  if (!activityId) return { success: false, error: 'Activitatea lipsește.' }

  const auth = await getTeacherActivityContext()
  if (!auth) return { success: false, error: 'Nu ești autentificat ca profesor.' }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('duplicate_teacher_activity_atomically', {
    p_activity_id: activityId,
    p_actor_id: auth.userId,
  })

  if (error || !data) {
    console.error('duplicateTeacherActivity RPC error:', error)
    return { success: false, error: errorMessage(error) }
  }

  const duplicatedId = (data as { activity?: { id?: string } }).activity?.id ?? ''
  revalidatePath(ROUTES.TEACHER.ACTIVITIES)

  return { success: true, data: { activityId: duplicatedId } }
}
