import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LearningPath, LearningPathStep } from '../types';
import {
  LEARNING_PATH_SELECT,
  LEARNING_PATH_STEP_SELECT,
  mapLearningPathRow,
  mapLearningPathStepRow,
  type LearningPathRowSnake,
  type LearningPathStepRowSnake,
} from './types';

const idSchema = z.string().uuid();

export async function getPathById(
  supabase: SupabaseClient,
  teacherId: string,
  pathId: string,
): Promise<LearningPath | null> {
  const parsedTeacherId = idSchema.safeParse(teacherId);
  const parsedPathId = idSchema.safeParse(pathId);
  if (!parsedTeacherId.success || !parsedPathId.success) return null;

  const { data, error } = await supabase
    .from('learning_paths')
    .select(LEARNING_PATH_SELECT)
    .eq('id', parsedPathId.data)
    .or(
      `created_by.eq.${parsedTeacherId.data},and(owner_kind.eq.admin,status.eq.published)`,
    )
    .maybeSingle();

  if (error) {
    throw new Error(`getPathById failed: ${error.message}`);
  }

  return data ? mapLearningPathRow(data as LearningPathRowSnake) : null;
}

export async function getStepsForPath(
  supabase: SupabaseClient,
  pathId: string,
): Promise<LearningPathStep[]> {
  const parsedPathId = idSchema.safeParse(pathId);
  if (!parsedPathId.success) return [];

  const { data, error } = await supabase
    .from('learning_path_steps')
    .select(LEARNING_PATH_STEP_SELECT)
    .eq('path_id', parsedPathId.data)
    .order('step_order', { ascending: true });

  if (error) {
    throw new Error(`getStepsForPath failed: ${error.message}`);
  }

  return ((data ?? []) as LearningPathStepRowSnake[]).map(
    mapLearningPathStepRow,
  );
}
