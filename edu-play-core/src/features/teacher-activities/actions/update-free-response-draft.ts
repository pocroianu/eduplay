'use server';

import { revalidatePath } from 'next/cache';
import { ROUTES } from '@/shared/lib/constants';
import { persistTeacherDraft } from './draft-persistence';
import type { UpdateFreeResponseDraftResult } from '../types';

export async function updateFreeResponseDraft(activityId: string, input: unknown): Promise<UpdateFreeResponseDraftResult> {
  if (!activityId) return { success: false, error: 'Activitatea nu a fost găsită.' };
  const result = await persistTeacherDraft(input, activityId);
  if (result.success) {
    revalidatePath(ROUTES.TEACHER.ACTIVITIES);
    revalidatePath(ROUTES.TEACHER.ACTIVITY_EDIT(activityId));
    revalidatePath(ROUTES.PLAY.ACTIVITY(activityId));
  }
  return result;
}
