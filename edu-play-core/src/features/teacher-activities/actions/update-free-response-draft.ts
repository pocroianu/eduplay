'use server'

import { revalidatePath } from 'next/cache'

import { ROUTES } from '@/shared/lib/constants'
import { fieldErrorsFromDraftIssues, freeResponseDraftSchema } from './free-response-draft-schema'
import { getTeacherActivityContext } from './teacher-context'
import type { UpdateFreeResponseDraftResult } from '../types'

export async function updateFreeResponseDraft(
  activityId: string,
  input: unknown,
): Promise<UpdateFreeResponseDraftResult> {
  if (!activityId) return { success: false, error: 'Activitatea nu a fost găsită.' }

  const parsed = freeResponseDraftSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Date invalide.',
      fieldErrors: fieldErrorsFromDraftIssues(parsed.error),
    }
  }

  const auth = await getTeacherActivityContext()
  if (!auth) {
    return { success: false, error: 'Nu ești autentificat ca profesor.' }
  }

  const { data: current, error: currentError } = await auth.supabase
    .from('activities')
    .select('id, created_by, visibility_scope, template, status')
    .eq('id', activityId)
    .single()

  if (currentError || !current) {
    return { success: false, error: 'Activitatea nu a fost găsită.' }
  }

  if (current.created_by !== auth.userId || current.visibility_scope !== 'private') {
    return { success: false, error: 'Poți edita doar activitățile tale private.' }
  }

  if (current.template !== 'free-response') {
    return { success: false, error: 'Poți edita aici doar activități cu răspuns liber.' }
  }

  if (current.status !== 'draft') {
    return { success: false, error: 'Poți edita doar ciorne. Duplică activitatea gata dacă vrei o variantă nouă.' }
  }

  const { data: activityType, error: typeError } = await auth.supabase
    .from('activity_types')
    .select('type_id, version, authoring_mode')
    .eq('type_id', 'free-response')
    .single()

  if (typeError || !activityType) {
    return { success: false, error: 'Tipul de activitate cu răspuns liber nu este disponibil încă.' }
  }

  if (activityType.authoring_mode !== 'teacher-simple') {
    return { success: false, error: 'Tipul de activitate cu răspuns liber nu este disponibil pentru profesori.' }
  }

  const draft = parsed.data
  const { error: updateError } = await auth.supabase
    .from('activities')
    .update({
      title: draft.title,
      description: draft.prompt.slice(0, 180),
      config_data: {
        prompt: draft.prompt,
        allowedTools: draft.allowedTools,
        shareWithFamilyOnApproval: draft.shareWithFamilyOnApproval,
      },
      config_schema_version: activityType.version,
    })
    .eq('id', activityId)
    .eq('created_by', auth.userId)
    .eq('visibility_scope', 'private')
    .eq('template', 'free-response')
    .eq('status', 'draft')
    .select('id')
    .single()

  if (updateError) {
    console.error('updateFreeResponseDraft activity error:', updateError)
    return { success: false, error: 'Nu am putut salva modificările. Încearcă din nou.' }
  }

  const { error: deleteResourcesError } = await auth.supabase
    .from('activity_resources')
    .delete()
    .eq('activity_id', activityId)
    .is('version_id', null)

  if (deleteResourcesError) {
    console.error('updateFreeResponseDraft delete resources error:', deleteResourcesError)
    return { success: false, error: 'Activitatea a fost actualizată, dar resursele vechi nu au putut fi înlocuite.' }
  }

  if (draft.resources.length > 0) {
    const { error: resourcesError } = await auth.supabase
      .from('activity_resources')
      .insert(
        draft.resources.map((resource, index) => ({
          activity_id: activityId,
          version_id: null,
          resource_type: 'link',
          title: resource.title,
          url: resource.url,
          sort_order: index + 1,
          created_by: auth.userId,
        })),
      )

    if (resourcesError) {
      console.error('updateFreeResponseDraft insert resources error:', resourcesError)
      return { success: false, error: 'Activitatea a fost actualizată, dar resursele nu au putut fi salvate.' }
    }
  }

  revalidatePath(ROUTES.TEACHER.ACTIVITIES)
  revalidatePath(ROUTES.TEACHER.ACTIVITY_EDIT(activityId))
  revalidatePath(ROUTES.PLAY.ACTIVITY(activityId))

  return { success: true, data: { id: activityId } }
}
