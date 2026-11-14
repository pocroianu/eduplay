'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ROUTES } from '@/shared/lib/constants';
import type { ActionResult } from '../types';
import { requireTeacher } from './internal/require-teacher';

const assignmentIdSchema = z.string().uuid('ID-ul atribuirii este invalid');

export async function unassignPath(
  assignmentId: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = assignmentIdSchema.safeParse(assignmentId);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Date invalide',
    };
  }

  const auth = await requireTeacher();
  if (!auth.ok) return auth.error;

  const { data, error } = await auth.ctx.supabase
    .from('learning_path_assignments')
    .delete()
    .eq('id', parsed.data)
    .select('id, path_id, class_id, student_id')
    .maybeSingle();

  if (error) {
    return {
      success: false,
      error: 'Nu am putut retrage atribuirea. Încearcă din nou.',
    };
  }

  if (!data) {
    return {
      success: false,
      error: 'Atribuirea nu a fost găsită',
    };
  }

  revalidatePath(ROUTES.TEACHER.PATH(data.path_id));
  revalidatePath(ROUTES.TEACHER.PATHS);
  if (data.class_id) revalidatePath(ROUTES.TEACHER.CLASS(data.class_id));
  if (data.student_id) revalidatePath(ROUTES.TEACHER.STUDENT(data.student_id));

  return { success: true, data: { id: data.id } };
}
