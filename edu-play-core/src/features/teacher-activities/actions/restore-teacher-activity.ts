'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/server'
import { ROUTES } from '@/shared/lib/constants'
import { getTeacherActivityContext } from './teacher-context'
import type { RestoreTeacherActivityResult } from '../types'

function errorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : null
  if (code === '42501') return 'Nu ai dreptul să restaurezi această activitate.'
  if (code === 'P0002') return 'Nu am găsit activitatea.'
  return 'Nu am putut restaura activitatea. Încearcă din nou.'
}

export async function restoreTeacherActivity(activityId: string): Promise<RestoreTeacherActivityResult> {
  if (!activityId) return { success: false, error: 'Activitatea lipsește.' }

  const auth = await getTeacherActivityContext()
  if (!auth) return { success: false, error: 'Nu ești autentificat ca profesor.' }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('restore_teacher_activity_atomically', {
    p_activity_id: activityId,
    p_actor_id: auth.userId,
  })

  if (error || !data) {
    console.error('restoreTeacherActivity RPC error:', error)
    return { success: false, error: errorMessage(error) }
  }

  const restoredId = (data as { activity?: { id?: string } }).activity?.id ?? activityId
  revalidatePath(ROUTES.TEACHER.ACTIVITIES)
  revalidatePath(ROUTES.TEACHER.ASSIGNMENT_NEW)

  return { success: true, data: { activityId: restoredId } }
}

async function restoreTeacherActivityFromForm(formData: FormData): Promise<void> {
  const activityId = String(formData.get('activityId') ?? '')
  await restoreTeacherActivity(activityId)
}
