'use server'

import { redirect } from 'next/navigation'

import {
  cleanupExpiredPreviewSessions,
  createPreviewSession,
  validateConfigForType,
} from '@/features/activities/server'
import { getTeacherActivityContext } from './teacher-context'

interface PreviewActivityRow {
  id: string
  template: string
  visibility_scope: string | null
  config_data: unknown
  config_schema_version: number | null
  created_by: string | null
}

export async function createTeacherActivityPreview(activityId: string): Promise<void> {
  const auth = await getTeacherActivityContext()
  if (!auth || !activityId) redirect('/teacher/activities?tab=my')

  const { data: activity, error } = await auth.supabase
    .from('activities')
    .select('id, template, visibility_scope, config_data, config_schema_version, created_by')
    .eq('id', activityId)
    .eq('visibility_scope', 'private')
    .maybeSingle<PreviewActivityRow>()

  if (error || !activity || activity.created_by !== auth.userId || !activity.config_data) {
    redirect('/teacher/activities?tab=my')
  }

  const activityType = await validateConfigForType(
    auth.supabase,
    activity.template,
    activity.config_data,
    'teacher activity preview',
  )

  if (activityType.authoringMode !== 'teacher-simple') {
    redirect('/teacher/activities?tab=my')
  }

  await cleanupExpiredPreviewSessions()
  const preview = await createPreviewSession(auth.supabase, {
    activityId: activity.id,
    typeId: activity.template,
    configData: activity.config_data,
    createdBy: auth.userId,
  })

  redirect(`/play/${activity.id}?previewId=${encodeURIComponent(preview.previewId)}`)
}
