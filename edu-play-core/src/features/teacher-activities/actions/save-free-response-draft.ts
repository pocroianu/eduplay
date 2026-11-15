'use server';

import { revalidatePath } from 'next/cache';
import { ROUTES } from '@/shared/lib/constants';
import { persistTeacherDraft } from './draft-persistence';
import type { SaveFreeResponseDraftResult } from '../types';

export async function saveFreeResponseDraft(input: unknown): Promise<SaveFreeResponseDraftResult> {
  const result = await persistTeacherDraft(input);
  if (result.success) {
    revalidatePath(ROUTES.TEACHER.ACTIVITIES);
    revalidatePath(ROUTES.TEACHER.ACTIVITY_CREATE);
  }
  return result;
}
