// Rewards — public (client-safe) entry point.
// Only exports types + the pure badge catalog. Query functions live on ./server.

export { BADGES } from './badges'
export type { BadgeDefinition, BadgeId, BadgeTone, BadgeThreshold } from './badges'
export type { BadgeStatus, StudentBadgeAggregates } from './queries/get-student-badges'
