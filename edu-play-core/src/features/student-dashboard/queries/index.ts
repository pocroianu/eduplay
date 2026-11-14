import { cache } from 'react'
import { getClassmateLeaderboard as _getClassmateLeaderboard } from './get-classmate-leaderboard'

export type { LeaderboardEntry } from './get-classmate-leaderboard'

export const getClassmateLeaderboard = cache(_getClassmateLeaderboard)
