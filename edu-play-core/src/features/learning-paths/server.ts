// Learning Paths Feature - Server-Only Exports
// Only import from this file in Server Components, Server Actions, and
// Route Handlers. NEVER import from this file in Client Components.

export {
  getPathsForTeacher,
  getPathById,
  getStepsForPath,
  getActivePathForStudent,
  getClassPathProgress,
  getAssignmentsForPath,
  type ActivePathForStudent,
  type StudentPathStepView,
  type StudentStepStatus,
  type ClassPathProgressResult,
  type ClassPathProgressRow,
  type ClassStudentSummary,
  type LearningPathAssignmentWithTarget,
} from './queries';

export {
  advanceActivityCompletionProgress,
} from './actions/auto-progression';
