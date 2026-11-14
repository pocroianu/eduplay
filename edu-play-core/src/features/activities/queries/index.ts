// Activities Queries
// Wrapped in React `cache()` so a layout + page composition that calls the
// same query in one render doesn't fan out into multiple DB round-trips.

import { cache } from 'react';
import { getActivityInstance as _getActivityInstance } from './get-activity-instance';
import { getStudentActivities as _getStudentActivities } from './get-student-activities';

export const getActivityInstance = cache(_getActivityInstance);
export const getStudentActivities = cache(_getStudentActivities);

export {
  mapActivityInstanceRow,
  ACTIVITY_INSTANCE_SELECT,
  type ActivityInstanceRow,
} from './types';
