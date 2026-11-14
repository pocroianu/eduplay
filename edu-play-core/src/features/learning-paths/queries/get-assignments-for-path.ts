import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LearningPathAssignment } from '../types';
import {
  LEARNING_PATH_ASSIGNMENT_SELECT,
  mapLearningPathAssignmentRow,
  type LearningPathAssignmentRowSnake,
} from './types';

const idSchema = z.string().uuid();

interface ClassJoinRow {
  id: string;
  name: string;
}

interface StudentProfileJoinRow {
  full_name: string | null;
}

interface StudentJoinRow {
  id: string;
  username: string;
  profile: StudentProfileJoinRow | StudentProfileJoinRow[] | null;
}

interface AssignmentWithTargetRow extends LearningPathAssignmentRowSnake {
  class: ClassJoinRow | ClassJoinRow[] | null;
  student: StudentJoinRow | StudentJoinRow[] | null;
}

export interface LearningPathAssignmentWithTarget
  extends LearningPathAssignment {
  targetType: 'class' | 'student';
  targetName: string;
  targetDetail: string | null;
}

function firstProfile(
  profile: StudentJoinRow['profile'],
): StudentProfileJoinRow | null {
  if (Array.isArray(profile)) return profile[0] ?? null;
  return profile;
}

function firstJoin<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function mapAssignmentWithTarget(
  row: AssignmentWithTargetRow,
): LearningPathAssignmentWithTarget {
  const assignment = mapLearningPathAssignmentRow(row);
  const classRow = firstJoin(row.class);
  const studentRow = firstJoin(row.student);

  if (row.class_id) {
    return {
      ...assignment,
      targetType: 'class',
      targetName: classRow?.name ?? 'Clasă necunoscută',
      targetDetail: null,
    };
  }

  const profile = firstProfile(studentRow?.profile ?? null);
  return {
    ...assignment,
    targetType: 'student',
    targetName: profile?.full_name ?? studentRow?.username ?? 'Elev necunoscut',
    targetDetail: studentRow?.username ?? null,
  };
}

export async function getAssignmentsForPath(
  supabase: SupabaseClient,
  pathId: string,
): Promise<LearningPathAssignmentWithTarget[]> {
  const parsedPathId = idSchema.safeParse(pathId);
  if (!parsedPathId.success) return [];

  const { data, error } = await supabase
    .from('learning_path_assignments')
    .select(
      `${LEARNING_PATH_ASSIGNMENT_SELECT},
      class:classes!learning_path_assignments_class_id_fkey(id, name),
      student:students!learning_path_assignments_student_id_fkey(
        id,
        username,
        profile:profiles!students_id_fkey(full_name)
      )`,
    )
    .eq('path_id', parsedPathId.data)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`getAssignmentsForPath failed: ${error.message}`);
  }

  return ((data ?? []) as unknown as AssignmentWithTargetRow[]).map(
    mapAssignmentWithTarget,
  );
}
