// Learning Paths Feature - Shared Types
//
// Mirrors the four tables introduced in migration 20260501200000:
//   - learning_paths
//   - learning_path_steps
//   - learning_path_assignments
//   - student_path_progress
//
// DB rows (snake_case) are re-exported from the generated Database typings;
// camelCase aliases are the shape the rest of the app consumes.

import type { Database } from '@/shared/types/database';

export type LearningPathRow =
  Database['public']['Tables']['learning_paths']['Row'];
export type LearningPathInsert =
  Database['public']['Tables']['learning_paths']['Insert'];
export type LearningPathUpdate =
  Database['public']['Tables']['learning_paths']['Update'];

export type LearningPathStepRow =
  Database['public']['Tables']['learning_path_steps']['Row'];
export type LearningPathStepInsert =
  Database['public']['Tables']['learning_path_steps']['Insert'];

export type LearningPathAssignmentRow =
  Database['public']['Tables']['learning_path_assignments']['Row'];
export type LearningPathAssignmentInsert =
  Database['public']['Tables']['learning_path_assignments']['Insert'];

export type StudentPathProgressRow =
  Database['public']['Tables']['student_path_progress']['Row'];
export type StudentPathProgressInsert =
  Database['public']['Tables']['student_path_progress']['Insert'];

/**
 * Lifecycle states a `learning_paths.status` row can hold (mirrors the
 * Postgres CHECK constraint).
 */
export const LEARNING_PATH_STATUSES = [
  'draft',
  'published',
  'archived',
] as const;
export type LearningPathStatus = (typeof LEARNING_PATH_STATUSES)[number];

/**
 * Owner kinds for a path (`teacher` for ownership-scoped paths, `admin`
 * for the curated library shared across the platform).
 */
export const LEARNING_PATH_OWNER_KINDS = ['admin', 'teacher'] as const;
export type LearningPathOwnerKind = (typeof LEARNING_PATH_OWNER_KINDS)[number];

/**
 * Step kind enum (mirrors the CHECK constraint on
 * `learning_path_steps.kind`).
 */
export const LEARNING_PATH_STEP_KINDS = ['activity_template'] as const;
export type LearningPathStepKind = (typeof LEARNING_PATH_STEP_KINDS)[number];

/**
 * Per-student progress states along a path.
 */
export const STUDENT_PATH_PROGRESS_STATUSES = [
  'not_started',
  'in_progress',
  'completed',
  'overridden',
] as const;
export type StudentPathProgressStatus =
  (typeof STUDENT_PATH_PROGRESS_STATUSES)[number];

/**
 * Camel-cased read shape for a learning path. Returned by feature queries
 * after `mapLearningPathRow`.
 */
export interface LearningPath {
  id: string;
  title: string;
  description: string | null;
  ageMin: number | null;
  ageMax: number | null;
  status: LearningPathStatus;
  ownerKind: LearningPathOwnerKind;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Camel-cased read shape for a step inside a path.
 */
export interface LearningPathStep {
  id: string;
  pathId: string;
  stepOrder: number;
  kind: LearningPathStepKind;
  targetActivityType: string | null;
  targetActivityConfig: unknown;
  title: string;
  description: string | null;
  createdAt: string;
}

/**
 * Camel-cased read shape for a path assignment.
 */
export interface LearningPathAssignment {
  id: string;
  pathId: string;
  classId: string | null;
  studentId: string | null;
  assignedBy: string;
  dueDate: string | null;
  createdAt: string;
}

/**
 * Camel-cased read shape for per-student progress.
 */
export interface StudentPathProgress {
  id: string;
  studentId: string;
  pathId: string;
  currentStepId: string | null;
  lastCompletedStepId: string | null;
  status: StudentPathProgressStatus;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

/**
 * Pattern B return contract for learning-paths server actions.
 * See CLAUDE.md § Server Action Return Contracts.
 */
export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}
