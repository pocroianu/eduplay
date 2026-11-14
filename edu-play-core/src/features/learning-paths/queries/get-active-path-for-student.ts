import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LearningPath,
  LearningPathStep,
  StudentPathProgress,
  StudentPathProgressStatus,
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

const studentIdSchema = z.string().uuid();

/**
 * Per-step status used by the student journey-map renderer (EDU-31.E).
 * Derived from the `student_path_progress` row plus the step ordering —
 * pure, no extra DB hit.
 */
export type StudentStepStatus = 'completed' | 'current' | 'locked';

export interface StudentPathStepView extends LearningPathStep {
  studentStatus: StudentStepStatus;
}

export interface ActivePathForStudent {
  path: LearningPath;
  steps: StudentPathStepView[];
  progress: StudentPathProgress | null;
}

/**
 * Resolves the student's currently-active path along with ordered steps
 * and a per-step status flag.
 *
 * v1 path picker rule (EDU-31 plan §4): a student is at most enrolled in
 * one path at a time; the "active" one is the most recently-assigned path
 * that does not yet have `status = 'completed'` progress. If no progress
 * row exists yet, the path is still active (status `not_started`).
 *
 * Returns `null` when the student has no assigned path.
 *
 * RLS gates which assignment / path / progress rows the call can see;
 * this query relies on it rather than re-checking ownership client-side.
 */
export async function getActivePathForStudent(
  supabase: SupabaseClient,
  studentId: string,
): Promise<ActivePathForStudent | null> {
  const parsed = studentIdSchema.safeParse(studentId);
  if (!parsed.success) return null;

  // Resolve the student's class explicitly so the assignment filter scopes
  // class assignments to *this* student's class, not "any class". RLS does
  // the same scoping server-side, but CLAUDE.md §Security Checklist asks
  // every query to mirror the policy locally as defense-in-depth — the
  // SQL then reads the way it intends to behave (CTO review of PR #144).
  const { data: studentRow, error: studentError } = await supabase
    .from('students')
    .select('class_id')
    .eq('id', parsed.data)
    .maybeSingle();

  if (studentError) {
    throw new Error(
      `getActivePathForStudent failed (student): ${studentError.message}`,
    );
  }

  const classFilterIds = studentRow?.class_id ? [studentRow.class_id] : [];
  const orFilter = classFilterIds.length
    ? `student_id.eq.${parsed.data},class_id.in.(${classFilterIds.join(',')})`
    : `student_id.eq.${parsed.data}`;

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from('learning_path_assignments')
    .select('path_id, created_at')
    .or(orFilter)
    .order('created_at', { ascending: false });

  if (assignmentError) {
    throw new Error(
      `getActivePathForStudent failed (assignments): ${assignmentError.message}`,
    );
  }

  const candidatePathIds = Array.from(
    new Set((assignmentRows ?? []).map((row) => row.path_id)),
  );
  if (candidatePathIds.length === 0) return null;

  // Fetch progress rows for the candidate paths so we can pick the most
  // recent assignment that is not yet completed. RLS keeps the row-set to
  // this student's own progress.
  const { data: progressRows, error: progressError } = await supabase
    .from('student_path_progress')
    .select(STUDENT_PATH_PROGRESS_SELECT)
    .eq('student_id', parsed.data)
    .in('path_id', candidatePathIds);

  if (progressError) {
    throw new Error(
      `getActivePathForStudent failed (progress): ${progressError.message}`,
    );
  }

  const progressByPath = new Map<string, StudentPathProgressRowSnake>();
  for (const row of (progressRows ?? []) as StudentPathProgressRowSnake[]) {
    progressByPath.set(row.path_id, row);
  }

  const activePathId = candidatePathIds.find((pathId) => {
    const progress = progressByPath.get(pathId);
    if (!progress) return true;
    return progress.status !== 'completed' && progress.status !== 'overridden';
  });

  if (!activePathId) return null;

  const [pathRes, stepsRes] = await Promise.all([
    supabase
      .from('learning_paths')
      .select(LEARNING_PATH_SELECT)
      .eq('id', activePathId)
      .maybeSingle(),
    supabase
      .from('learning_path_steps')
      .select(LEARNING_PATH_STEP_SELECT)
      .eq('path_id', activePathId)
      .order('step_order', { ascending: true }),
  ]);

  if (pathRes.error) {
    throw new Error(
      `getActivePathForStudent failed (path): ${pathRes.error.message}`,
    );
  }
  if (!pathRes.data) return null;
  if (stepsRes.error) {
    throw new Error(
      `getActivePathForStudent failed (steps): ${stepsRes.error.message}`,
    );
  }

  const progressRow = progressByPath.get(activePathId) ?? null;
  const steps = ((stepsRes.data ?? []) as LearningPathStepRowSnake[]).map(
    mapLearningPathStepRow,
  );

  return {
    path: mapLearningPathRow(pathRes.data as LearningPathRowSnake),
    progress: progressRow ? mapStudentPathProgressRow(progressRow) : null,
    steps: deriveStudentStepStatuses(steps, progressRow?.status, progressRow),
  };
}

function deriveStudentStepStatuses(
  steps: LearningPathStep[],
  progressStatus: StudentPathProgressStatus | string | undefined,
  progressRow: StudentPathProgressRowSnake | null,
): StudentPathStepView[] {
  if (!progressRow || progressStatus === 'not_started') {
    return steps.map((step, idx) => ({
      ...step,
      studentStatus: idx === 0 ? 'current' : 'locked',
    }));
  }

  if (progressStatus === 'completed' || progressStatus === 'overridden') {
    return steps.map((step) => ({ ...step, studentStatus: 'completed' }));
  }

  // in_progress: walk the ordered list and split on the current_step_id /
  // last_completed_step_id boundary.
  const lastCompletedIdx = progressRow.last_completed_step_id
    ? steps.findIndex((s) => s.id === progressRow.last_completed_step_id)
    : -1;
  const currentIdx = progressRow.current_step_id
    ? steps.findIndex((s) => s.id === progressRow.current_step_id)
    : lastCompletedIdx + 1;

  return steps.map((step, idx) => {
    if (idx <= lastCompletedIdx) {
      return { ...step, studentStatus: 'completed' };
    }
    if (idx === currentIdx) {
      return { ...step, studentStatus: 'current' };
    }
    return { ...step, studentStatus: 'locked' };
  });
}
