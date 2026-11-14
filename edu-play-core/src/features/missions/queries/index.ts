import { cache } from 'react'
import {
  getTodayMissions as _getTodayMissions,
  pickTodayMissions,
  type Mission,
  type MissionTone,
} from './get-today-missions'

export { pickTodayMissions }
export type { Mission, MissionTone }

export const getTodayMissions = cache(_getTodayMissions)
