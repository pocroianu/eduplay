// Rewards — server-only entry point.
// Import from this file in Server Components, Server Actions, Route Handlers.
// Never import this file from a Client Component.

export { getStudentBadges, computeBadgeStatuses, aggregateFromProgressRows } from './queries'
export type { BadgeStatus, StudentBadgeAggregates } from './queries'
export { BADGES } from './badges'
export type { BadgeDefinition, BadgeId, BadgeTone, BadgeThreshold } from './badges'
