'use server';

import { revalidatePath } from 'next/cache';
import { teacherUploadArtifactSchema } from '../schemas';
import type { ActionResult } from '../types';
import {
  runTeacherUploadArtifact,
  type TeacherUploadArtifactData,
} from './internal/run-teacher-upload-artifact';

/**
 * Records a teacher-authored `child_artifacts` entry from the F6 Phase 2A
 * upload flow. Accepts a photo (JPEG/WebP) or audio (WebM/Ogg) payload
 * and writes it under the student's storage folder at `visibility:
 * 'draft'`, ready for the existing teacher review queue.
 *
 * The action runs with the teacher's session-bound Supabase client; the
 * `students` SELECT RLS plus the new storage and table INSERT policies
 * (migration 20260508000002) confirm the caller actually has the
 * requested student in one of their classes. The service role is only
 * used for orphan-blob cleanup if the row INSERT fails.
 */
export async function teacherUploadArtifact(
  input: unknown,
): Promise<ActionResult<TeacherUploadArtifactData>> {
  const parsed = teacherUploadArtifactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Date invalide',
    };
  }

  const result = await runTeacherUploadArtifact(parsed.data);
  if (result.success) {
    revalidatePath('/teacher/portfolio');
  }
  return result;
}
