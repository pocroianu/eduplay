// Learning Paths Queries
//
// Wrapped in React `cache()` so a layout + page composition that calls the
// same query in one render doesn't fan out into multiple DB round-trips.

import { cache } from 'react';
import { getPathsForTeacher as _getPathsForTeacher } from './get-paths-for-teacher';
import {
  getPathById as _getPathById,
  getStepsForPath as _getStepsForPath,
} from './get-path-detail';
import { getActivePathForStudent as _getActivePathForStudent } from './get-active-path-for-student';
import { getClassPathProgress as _getClassPathProgress } from './get-class-path-progress';
import { getAssignmentsForPath as _getAssignmentsForPath } from './get-assignments-for-path';

export const getPathsForTeacher = cache(_getPathsForTeacher);
export const getPathById = cache(_getPathById);
export const getStepsForPath = cache(_getStepsForPath);
export const getActivePathForStudent = cache(_getActivePathForStudent);
export const getClassPathProgress = cache(_getClassPathProgress);
export const getAssignmentsForPath = cache(_getAssignmentsForPath);

export type {
  ActivePathForStudent,
  StudentPathStepView,
  StudentStepStatus,
} from './get-active-path-for-student';
export type {
  ClassPathProgressResult,
  ClassPathProgressRow,
  ClassStudentSummary,
} from './get-class-path-progress';
export type { LearningPathAssignmentWithTarget } from './get-assignments-for-path';
export {
  LEARNING_PATH_SELECT,
  LEARNING_PATH_STEP_SELECT,
  LEARNING_PATH_ASSIGNMENT_SELECT,
  STUDENT_PATH_PROGRESS_SELECT,
  mapLearningPathRow,
  mapLearningPathStepRow,
  mapLearningPathAssignmentRow,
  mapStudentPathProgressRow,
  type LearningPathRowSnake,
  type LearningPathStepRowSnake,
  type LearningPathAssignmentRowSnake,
  type StudentPathProgressRowSnake,
} from './types';
