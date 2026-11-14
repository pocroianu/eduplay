// src/lib/api/index.ts — Barrel export for API utilities

export { ApiError, type ErrorCode } from './errors';
export {
  success,
  created,
  noContent,
  rawJson,
  paginated,
  error,
  handleRoute,
  type ApiResponse,
} from './response';
export { requireAuth, requireRole, type AuthContext } from './auth';
export {
  parsePagination,
  toRange,
  buildMeta,
  paginationSchema,
  type PaginationParams,
  type PaginationMeta,
} from './pagination';
export { parseBody, parseQuery } from './validation';
export { parseRow, parseRows } from './parse-row';
export {
  camelCaseKeys,
  snakeCaseKeys,
  toCamelCase,
  toSnakeCase,
} from './transform';
export {
  getTeacherClassIds,
  getParentChildIds,
  assertTeacherOwnsClass,
  assertTeacherOwnsStudent,
  getScopedStudentIds,
  getScopedClassIds,
  type ScopedStudentResult,
  type ScopedClassResult,
} from './scope';
