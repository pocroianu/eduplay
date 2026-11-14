'use server'

import { revalidatePath } from 'next/cache'

import { ROUTES } from '@/shared/lib/constants'
import { fieldErrorsFromDraftIssues, freeResponseDraftSchema } from './free-response-draft-schema'
import { getTeacherActivityContext } from './teacher-context'
import type { SaveFreeResponseDraftResult } from '../types'

export async function saveFreeResponseDraft(input: unknown): Promise<SaveFreeResponseDraftResult> {
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
  const { data, error } = await auth.supabase
    .from('activities')
    .insert({
      template: 'free-response',
      title: draft.title,
      description: draft.prompt.slice(0, 180),
      default_lang: 'ro',
      category: 'creative',
      difficulty: 'easy',
      status: 'draft',
      is_published: false,
      visibility_scope: 'private',
      config_data: {
        prompt: draft.prompt,
        allowedTools: draft.allowedTools,
        shareWithFamilyOnApproval: draft.shareWithFamilyOnApproval,
      },
      config_schema_version: activityType.version,
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('saveFreeResponseDraft error:', error)
    return { success: false, error: 'Nu am putut salva ciorna. Încearcă din nou.' }
  }

  if (draft.resources.length > 0) {
    const { error: resourcesError } = await auth.supabase
      .from('activity_resources')
      .insert(
        draft.resources.map((resource, index) => ({
          activity_id: data.id,
          version_id: null,
          resource_type: 'link',
          title: resource.title,
          url: resource.url,
          sort_order: index + 1,
          created_by: auth.userId,
        })),
      )

    if (resourcesError) {
      console.error('saveFreeResponseDraft resources error:', resourcesError)
      return { success: false, error: 'Ciorna a fost creată, dar resursele nu au putut fi salvate.' }
    }
  }

  revalidatePath(ROUTES.TEACHER.ACTIVITIES)
  revalidatePath(ROUTES.TEACHER.ACTIVITY_CREATE)

  return { success: true, data: { id: data.id } }
}
