import { cache } from 'react'
import { getStudentBadges as _getStudentBadges } from './get-student-badges'

export {
  computeBadgeStatuses,
  aggregateFromProgressRows,
  type BadgeStatus,
  type StudentBadgeAggregates,
  type BadgeDefinition,
  type BadgeId,
} from './get-student-badges'

export const getStudentBadges = cache(_getStudentBadges)
