import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import type {
  LearningPath,
  LearningPathStep,
  StudentPathProgress,
} from '../types';
import {
  LEARNING_PATH_SELECT,
  LEARNING_PATH_STEP_SELECT,
  STUDENT_PATH_PROGRESS_SELECT,
  mapLearningPathRow,
  mapLearningPathStepRow,
  mapStudentPathProgressRow,
  type LearningPathRowSnake,
  type LearningPathStepRowSnake,
  type StudentPathProgressRowSnake,
} from './types';

const classIdSchema = z.string().uuid();

export interface ClassStudentSummary {
  studentId: string;
  username: string;
  fullName: string | null;
}

export interface ClassPathProgressRow {
  student: ClassStudentSummary;
  progress: StudentPathProgress | null;
}

/**
 * Outcomes for `getClassPathProgress`:
 *
 *   - `ok: true`  — caller may render the matrix.
 *   - `ok: false` with `reason: 'not_found'`  — path or class invisible to
 *     the caller (RLS-negative or non-existent ID).
 *   - `ok: false` with `reason: 'not_assigned'`  — path exists and is
 *     visible, but is not assigned to this class. Distinct from
 *     `not_found` so the matrix view can render the right empty state
 *     (the difference matters for UX: "you don't own this path" vs
 *     "you haven't assigned this path here yet").
 */
export type ClassPathProgressResult =
  | {
      ok: true;
      path: LearningPath;
      steps: LearningPathStep[];
      rows: ClassPathProgressRow[];
    }
  | { ok: false; reason: 'not_found' | 'not_assigned' };

/**
 * Returns the per-student progress matrix for a single (path, class) tuple.
 * Used by the teacher's class-progress matrix view (EDU-31.G) to render
 * "who's where" along the path without N+1 fetches.
 *
 * Pre-checks the assignment row exists so callers can distinguish
 * "this path isn't assigned here" from "no students have started yet" —
 * the matrix UI surfaces them with different empty-state copy
 * (CTO review of PR #144, EDU-309).
 */
export async function getClassPathProgress(
  supabase: SupabaseClient,
  pathId: string,
  classId: string,
): Promise<ClassPathProgressResult> {
  const parsedPath = classIdSchema.safeParse(pathId);
  const parsedClass = classIdSchema.safeParse(classId);
  if (!parsedPath.success || !parsedClass.success) {
    return { ok: false, reason: 'not_found' };
  }

  const [pathRes, assignmentRes] = await Promise.all([
    supabase
      .from('learning_paths')
      .select(LEARNING_PATH_SELECT)
      .eq('id', parsedPath.data)
      .maybeSingle(),
    supabase
      .from('learning_path_assignments')
      .select('id')
      .eq('path_id', parsedPath.data)
      .eq('class_id', parsedClass.data)
      .limit(1),
  ]);

  if (pathRes.error) {
    throw new Error(
      `getClassPathProgress failed (path): ${pathRes.error.message}`,
    );
  }
  if (!pathRes.data) {
    return { ok: false, reason: 'not_found' };
  }

  if (assignmentRes.error) {
    throw new Error(
      `getClassPathProgress failed (assignment): ${assignmentRes.error.message}`,
    );
  }
  if (!assignmentRes.data || assignmentRes.data.length === 0) {
    return { ok: false, reason: 'not_assigned' };
  }

  // At this point the caller has proven visibility to the exact
  // (path_id, class_id) assignment through RLS. Use the admin client only for
  // the roster/progress fan-out so admin contexts are not hidden by students
  // table policies that are teacher/parent scoped.
  const visibilityClient = createAdminClient();
  const [studentsRes, stepsRes] = await Promise.all([
    visibilityClient
      .from('students')
      .select(
        `id, username,
        profile:profiles!students_id_fkey(full_name)`,
      )
      .eq('class_id', parsedClass.data)
      .order('username', { ascending: true }),
    visibilityClient
      .from('learning_path_steps')
      .select(LEARNING_PATH_STEP_SELECT)
      .eq('path_id', parsedPath.data)
      .order('step_order', { ascending: true }),
  ]);

  if (studentsRes.error) {
    throw new Error(
      `getClassPathProgress failed (students): ${studentsRes.error.message}`,
    );
  }
  if (stepsRes.error) {
    throw new Error(
      `getClassPathProgress failed (steps): ${stepsRes.error.message}`,
    );
  }

  const steps = ((stepsRes.data ?? []) as LearningPathStepRowSnake[]).map(
    mapLearningPathStepRow,
  );

  const students = (studentsRes.data ?? []) as Array<{
    id: string;
    username: string;
    profile: { full_name: string | null } | { full_name: string | null }[] | null;
  }>;
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return {
      ok: true,
      path: mapLearningPathRow(pathRes.data as LearningPathRowSnake),
      steps,
      rows: [],
    };
  }

  const { data: progressRows, error: progressError } = await visibilityClient
    .from('student_path_progress')
    .select(STUDENT_PATH_PROGRESS_SELECT)
    .eq('path_id', parsedPath.data)
    .in('student_id', studentIds);

  if (progressError) {
    throw new Error(
      `getClassPathProgress failed (progress): ${progressError.message}`,
    );
  }

  const progressByStudent = new Map<string, StudentPathProgressRowSnake>();
  for (const row of (progressRows ?? []) as StudentPathProgressRowSnake[]) {
    progressByStudent.set(row.student_id, row);
  }

  return {
    ok: true,
    path: mapLearningPathRow(pathRes.data as LearningPathRowSnake),
    steps,
    rows: students.map((student) => {
      const progress = progressByStudent.get(student.id);
      return {
        student: {
          studentId: student.id,
          username: student.username,
          fullName: Array.isArray(student.profile)
            ? (student.profile[0]?.full_name ?? null)
            : (student.profile?.full_name ?? null),
        },
        progress: progress ? mapStudentPathProgressRow(progress) : null,
      };
    }),
  };
}
