'use server'

import { revalidatePath } from 'next/cache'

import { ApiError } from '@/lib/api'
import { createAdminClient } from '@/lib/supabase/server'
import { validateConfigForType } from '@/features/activities/server'
import { ROUTES } from '@/shared/lib/constants'
import { getTeacherActivityContext } from './teacher-context'
import type { MakeActivityReadyResult } from '../types'

interface ReadyActivityRow {
  id: string
  template: string
  status: string
  is_published: boolean | null
  visibility_scope: string | null
  config_data: unknown
  config_schema_version: number | null
  created_by: string | null
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Tipul acestei activități nu este disponibil.'
    if (error.status === 422) return 'Verifică instrucțiunile și opțiunile înainte să marchezi activitatea ca gata.'
  }

  if (error instanceof Error && error.message.includes('not authorized')) {
    return 'Nu ai dreptul să marchezi această activitate ca gata.'
  }

  return 'Nu am putut marca activitatea ca gata. Încearcă din nou.'
}

export async function makeActivityReady(activityId: string): Promise<MakeActivityReadyResult> {
  if (!activityId) return { success: false, error: 'Activitatea lipsește.' }

  const auth = await getTeacherActivityContext()
  if (!auth) {
    return { success: false, error: 'Nu ești autentificat ca profesor.' }
  }

  const { data: activity, error: activityError } = await auth.supabase
    .from('activities')
    .select('id, template, status, is_published, visibility_scope, config_data, config_schema_version, created_by')
    .eq('id', activityId)
    .eq('visibility_scope', 'private')
    .maybeSingle<ReadyActivityRow>()

  if (activityError || !activity || activity.created_by !== auth.userId) {
    return { success: false, error: 'Nu am găsit activitatea ta privată.' }
  }

  if (activity.status !== 'draft' && activity.status !== 'published') {
    return { success: false, error: 'Doar ciornele sau activitățile gata pot fi marcate ca gata.' }
  }

  if (!activity.config_data || !activity.config_schema_version) {
    return { success: false, error: 'Completează activitatea înainte să o marchezi ca gata.' }
  }

  try {
    const activityType = await validateConfigForType(
      auth.supabase,
      activity.template,
      activity.config_data,
      'teacher activity ready',
    )

    if (activityType.authoringMode !== 'teacher-simple') {
      return { success: false, error: 'Acest tip de activitate nu poate fi pregătit de profesori.' }
    }

    if (activityType.version !== activity.config_schema_version) {
      return { success: false, error: 'Schema activității s-a schimbat. Salvează din nou ciorna înainte să continui.' }
    }

    const admin = createAdminClient()
    const { data, error } = await admin.rpc('make_teacher_activity_ready_atomically', {
      p_activity_id: activity.id,
      p_activity_type_id: activity.template,
      p_actor_id: auth.userId,
      p_before_config_schema_version: activity.config_schema_version,
      p_before_is_published: activity.is_published ?? false,
      p_before_status: activity.status,
      p_config_data: activity.config_data,
      p_config_schema_version: activity.config_schema_version,
    })

    if (error || !data) {
      console.error('makeActivityReady RPC error:', error)
      return { success: false, error: getErrorMessage(error) }
    }

    const version = (data as { version?: { id?: string; version_number?: number } }).version
    revalidatePath(ROUTES.TEACHER.ACTIVITIES)
    revalidatePath(ROUTES.TEACHER.ASSIGNMENT_NEW)

    return {
      success: true,
      data: {
        activityId: activity.id,
        versionId: version?.id ?? '',
        versionNumber: version?.version_number ?? 0,
      },
    }
  } catch (error) {
    console.error('makeActivityReady error:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

async function makeActivityReadyFromForm(formData: FormData): Promise<void> {
  const activityId = String(formData.get('activityId') ?? '')
  await makeActivityReady(activityId)
}
