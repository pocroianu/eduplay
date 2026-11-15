import 'server-only';

import type { Json } from '@/shared/types/database';
import { fieldErrorsFromDraftIssues, freeResponseDraftSchema } from './free-response-draft-schema';
import { getTeacherActivityContext } from './teacher-context';
import type { SaveFreeResponseDraftResult } from '../types';

export async function persistTeacherDraft(input: unknown, activityId?: string): Promise<SaveFreeResponseDraftResult> {
  const parsed = freeResponseDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Date invalide.',
      fieldErrors: fieldErrorsFromDraftIssues(parsed.error) };
  }
  const auth = await getTeacherActivityContext();
  if (!auth) return { success: false, error: 'Nu ești autentificat ca profesor.' };

  const { data, error } = await auth.supabase.rpc('save_teacher_activity_draft', {
    p_draft: parsed.data as Json,
    p_activity_id: activityId,
  });
  if (error || !data) {
    const messages: Record<string, string> = {
      '42501': 'Poți edita doar activitățile tale private.',
      '23514': 'Poți edita doar ciorne. Duplică activitatea gata dacă vrei o variantă nouă.',
      '22023': 'Verifică instrucțiunile și resursele activității.',
      'P0002': 'Tipul de activitate cu răspuns liber nu este disponibil pentru profesori.',
    };
    return { success: false, error: messages[error?.code ?? ''] ?? 'Nu am putut salva ciorna. Încearcă din nou.' };
  }
  return { success: true, data: { id: data } };
}
