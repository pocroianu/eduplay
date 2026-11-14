import { describe, it, expect } from 'vitest'
import {
  aggregateFromProgressRows,
  computeBadgeStatuses,
} from './get-student-badges'
import { BADGES } from '../badges'

describe('aggregateFromProgressRows', () => {
  it('reduces empty progress to zeroed aggregates', () => {
    expect(aggregateFromProgressRows([])).toEqual({
      gamesPlayed: 0,
      completedGames: 0,
      totalScore: 0,
      streak: 0,
    })
  })

  it('counts plays, completions, and total score', () => {
    const rows = [
      { status: 'completed', score: 100, last_played_at: null },
      { status: 'in_progress', score: 40, last_played_at: null },
      { status: 'completed', score: 60, last_played_at: null },
    ]
    const agg = aggregateFromProgressRows(rows)
    expect(agg.gamesPlayed).toBe(3)
    expect(agg.completedGames).toBe(2)
    expect(agg.totalScore).toBe(200)
  })

  it('treats null score as zero', () => {
    const rows = [
      { status: 'completed', score: null, last_played_at: null },
      { status: 'in_progress', score: null, last_played_at: null },
    ]
    expect(aggregateFromProgressRows(rows).totalScore).toBe(0)
  })

  it('computes streak as distinct active days within the last 7 days', () => {
    const now = Date.now()
    const day = (offsetDays: number) =>
      new Date(now - offsetDays * 24 * 60 * 60 * 1000).toISOString()
    const rows = [
      { status: 'completed', score: 10, last_played_at: day(0) },
      { status: 'completed', score: 20, last_played_at: day(1) },
      // Duplicate day — should not double-count.
      { status: 'in_progress', score: 5, last_played_at: day(1) },
      // Outside the 7-day window — should be ignored.
      { status: 'completed', score: 5, last_played_at: day(30) },
    ]
    expect(aggregateFromProgressRows(rows).streak).toBe(2)
  })
})

describe('computeBadgeStatuses', () => {
  it('returns one entry per catalog badge', () => {
    const statuses = computeBadgeStatuses({
      gamesPlayed: 0,
      completedGames: 0,
      totalScore: 0,
      streak: 0,
    })
    expect(statuses).toHaveLength(BADGES.length)
  })

  it('marks a badge earned when its metric meets the threshold', () => {
    const statuses = computeBadgeStatuses({
      gamesPlayed: 5,
      completedGames: 10,
      totalScore: 600,
      streak: 7,
    })
    expect(statuses.every((s) => s.earned)).toBe(true)
  })

  it('clamps progress at the threshold so UI bars do not overflow', () => {
    const statuses = computeBadgeStatuses({
      gamesPlayed: 1000,
      completedGames: 0,
      totalScore: 0,
      streak: 0,
    })
    const explorer = statuses.find((s) => s.badge.id === 'explorer')
    expect(explorer).toBeDefined()
    expect(explorer!.progress).toBe(explorer!.badge.threshold.min)
    expect(explorer!.earned).toBe(true)
  })

  it('reports locked badges when thresholds are not met', () => {
    const statuses = computeBadgeStatuses({
      gamesPlayed: 0,
      completedGames: 0,
      totalScore: 0,
      streak: 0,
    })
    expect(statuses.every((s) => !s.earned)).toBe(true)
    expect(statuses.every((s) => s.progress === 0)).toBe(true)
  })
})
