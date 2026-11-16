// Shared row types + select column lists for learning-paths queries.
//
// Mirrors the migration in
// supabase/migrations/20261116225053_baseline.sql exactly. Pure
// mappers translate snake_case rows into the camel-cased shapes the
// feature module exposes.

import type {
  LearningPath,
  LearningPathAssignment,
  LearningPathOwnerKind,
  LearningPathStatus,
  LearningPathStep,
  LearningPathStepKind,
  StudentPathProgress,
  StudentPathProgressStatus,
} from '../types';

// ---------- learning_paths ----------

export interface LearningPathRowSnake {
  id: string;
  title: string;
  description: string | null;
  age_min: number | null;
  age_max: number | null;
  status: string;
  owner_kind: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const LEARNING_PATH_SELECT =
  'id, title, description, age_min, age_max, status, owner_kind, created_by, created_at, updated_at' as const;

export function mapLearningPathRow(row: LearningPathRowSnake): LearningPath {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    ageMin: row.age_min,
    ageMax: row.age_max,
    status: row.status as LearningPathStatus,
    ownerKind: row.owner_kind as LearningPathOwnerKind,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------- learning_path_steps ----------

export interface LearningPathStepRowSnake {
  id: string;
  path_id: string;
  step_order: number;
  kind: string;
  target_activity_type: string | null;
  target_activity_config: unknown;
  title: string;
  description: string | null;
  created_at: string;
}

export const LEARNING_PATH_STEP_SELECT =
  'id, path_id, step_order, kind, target_activity_type, target_activity_config, title, description, created_at' as const;

export function mapLearningPathStepRow(
  row: LearningPathStepRowSnake,
): LearningPathStep {
  return {
    id: row.id,
    pathId: row.path_id,
    stepOrder: row.step_order,
    kind: row.kind as LearningPathStepKind,
    targetActivityType: row.target_activity_type,
    targetActivityConfig: row.target_activity_config,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
  };
}

// ---------- learning_path_assignments ----------

export interface LearningPathAssignmentRowSnake {
  id: string;
  path_id: string;
  class_id: string | null;
  student_id: string | null;
  assigned_by: string;
  due_date: string | null;
  created_at: string;
}

export const LEARNING_PATH_ASSIGNMENT_SELECT =
  'id, path_id, class_id, student_id, assigned_by, due_date, created_at' as const;

export function mapLearningPathAssignmentRow(
  row: LearningPathAssignmentRowSnake,
): LearningPathAssignment {
  return {
    id: row.id,
    pathId: row.path_id,
    classId: row.class_id,
    studentId: row.student_id,
    assignedBy: row.assigned_by,
    dueDate: row.due_date,
    createdAt: row.created_at,
  };
}

// ---------- student_path_progress ----------

export interface StudentPathProgressRowSnake {
  id: string;
  student_id: string;
  path_id: string;
  current_step_id: string | null;
  last_completed_step_id: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export const STUDENT_PATH_PROGRESS_SELECT =
  'id, student_id, path_id, current_step_id, last_completed_step_id, status, started_at, completed_at, updated_at' as const;

export function mapStudentPathProgressRow(
  row: StudentPathProgressRowSnake,
): StudentPathProgress {
  return {
    id: row.id,
    studentId: row.student_id,
    pathId: row.path_id,
    currentStepId: row.current_step_id,
    lastCompletedStepId: row.last_completed_step_id,
    status: row.status as StudentPathProgressStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}
