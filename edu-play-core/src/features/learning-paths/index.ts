// Learning Paths Feature Module - Public API
// Client-safe exports only. Query functions live in `./server` per
// CLAUDE.md § Server/Client Code Separation.

export type {
  ActionResult,
  LearningPath,
  LearningPathStep,
  LearningPathAssignment,
  StudentPathProgress,
  LearningPathStatus,
  LearningPathOwnerKind,
  LearningPathStepKind,
  StudentPathProgressStatus,
  LearningPathRow,
  LearningPathInsert,
  LearningPathUpdate,
  LearningPathStepRow,
  LearningPathStepInsert,
  LearningPathAssignmentRow,
  LearningPathAssignmentInsert,
  StudentPathProgressRow,
  StudentPathProgressInsert,
} from './types';

export {
  LEARNING_PATH_STATUSES,
  LEARNING_PATH_OWNER_KINDS,
  LEARNING_PATH_STEP_KINDS,
  STUDENT_PATH_PROGRESS_STATUSES,
} from './types';

export {
  learningPathSchema,
  studentPathProgressSchema,
  createPathInputSchema,
  addStepInputSchema,
  reorderStepsInputSchema,
  assignPathInputSchema,
  overrideProgressInputSchema,
  advanceProgressInputSchema,
  pathIdSchema,
  type LearningPathSchemaShape,
  type StudentPathProgressSchemaShape,
  type CreatePathInput,
  type AddStepInput,
  type ReorderStepsInput,
  type AssignPathInput,
  type OverrideProgressInput,
  type AdvanceProgressInput,
  type PathIdInput,
} from './schemas';

// Server actions are tree-shaken; importing them from the client barrel
// is the standard Next.js pattern (the bundler swaps them for an RPC
// stub).
export {
  createPath,
  addStep,
  reorderSteps,
  publishPath,
  assignPath,
  unassignPath,
  overrideProgress,
} from './actions';

export { PathBuilder } from './components/PathBuilder';
export { PathAssignmentDialog } from './components/PathAssignmentDialog';
export { ClassPathProgressMatrix } from './components/ClassPathProgressMatrix';
export { TeacherPathCreateForm } from './components/TeacherPathCreateForm';
export type {
  PathAssignmentClassOption,
  PathAssignmentStudentOption,
} from './components/PathAssignmentDialog';
