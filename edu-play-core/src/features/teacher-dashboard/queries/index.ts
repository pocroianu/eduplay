export { getTeacherClasses } from './get-teacher-classes'
export { getClassStudents } from './get-class-students'
export { getTeacherAssignments, getAssignmentById } from './get-teacher-assignments'
export {
  buildStudentSummaries,
  buildRecentActivity,
  buildWeeklyActivity,
  buildSubjectSnapshot,
} from './aggregate-dashboard-stats'
export type {
  StudentSummary,
  RecentActivityItem,
  WeeklyActivityItem,
  SubjectSnapshotItem,
} from './aggregate-dashboard-stats'
export type { TeacherClassesResult } from './get-teacher-classes'
export type { ClassStudentsResult } from './get-class-students'
export type { AssignmentRow, TeacherAssignmentsResult } from './get-teacher-assignments'
export * from './types'
