import { describe, it, expect } from 'vitest'
import { pickTodayMissions } from './get-today-missions'

function makeAssignment(overrides: Partial<{
  id: string
  activity_id: string
  due_date: string | null
  created_at: string | null
  activity: {
    id: string
    title: string
    description: string | null
    category: string | null
    difficulty: string | null
  }
}> = {}) {
  const activity = overrides.activity ?? {
    id: overrides.activity_id ?? 'activity-1',
    title: 'Activitate de Test',
    description: 'Descriere',
    category: 'math',
    difficulty: 'medium',
  }
  return {
    id: overrides.id ?? 'assignment-1',
    activity_id: overrides.activity_id ?? activity.id,
    due_date: overrides.due_date ?? null,
    class_id: null,
    student_id: null,
    created_at: overrides.created_at ?? '2026-04-01T00:00:00Z',
    activities: activity,
  }
}

const today = new Date('2026-04-19T10:00:00Z')

describe('pickTodayMissions', () => {
  it('returns an empty array when there are no assignments', () => {
    expect(pickTodayMissions([], new Set(), today)).toEqual([])
  })

  it('prefers assignments whose due_date matches today', () => {
    const missions = pickTodayMissions(
      [
        makeAssignment({ id: 'today-1', due_date: '2026-04-19T23:00:00Z' }),
        makeAssignment({ id: 'tomorrow', due_date: '2026-04-20T08:00:00Z' }),
      ],
      new Set(),
      today,
    )
    expect(missions.map((m) => m.id)).toEqual(['today-1'])
  })

  it('falls back to the oldest uncompleted assignments when nothing is due today', () => {
    const missions = pickTodayMissions(
      [
        makeAssignment({ id: 'old', created_at: '2026-01-01T00:00:00Z' }),
        makeAssignment({ id: 'new', created_at: '2026-04-15T00:00:00Z' }),
      ],
      new Set(),
      today,
    )
    expect(missions.map((m) => m.id)).toEqual(['old', 'new'])
  })

  it('excludes activities the student has already completed', () => {
    const missions = pickTodayMissions(
      [
        makeAssignment({ id: 'a', activity_id: 'activity-1', due_date: '2026-04-19' }),
        makeAssignment({ id: 'b', activity_id: 'activity-2', due_date: '2026-04-19' }),
      ],
      new Set(['activity-1']),
      today,
    )
    expect(missions.map((m) => m.id)).toEqual(['b'])
  })

  it('caps the result at 3 missions', () => {
    const assignments = Array.from({ length: 8 }, (_, i) =>
      makeAssignment({
        id: `a${i}`,
        activity_id: `activity-${i}`,
        due_date: '2026-04-19T10:00:00Z',
      }),
    )
    const missions = pickTodayMissions(assignments, new Set(), today)
    expect(missions).toHaveLength(3)
  })

  it('derives icon + tone from the Activity category', () => {
    const missions = pickTodayMissions(
      [
        makeAssignment({
          id: 'math',
          activity: {
            id: 'activity-math',
            title: 'Matematică',
            description: 'desc',
            category: 'math',
            difficulty: 'medium',
          },
        }),
        makeAssignment({
          id: 'english',
          activity: {
            id: 'activity-english',
            title: 'Engleză',
            description: 'desc',
            category: 'english',
            difficulty: 'medium',
          },
        }),
      ],
      new Set(),
      today,
    )
    expect(missions[0].icon).toBe('Calculator')
    expect(missions[0].tone).toBe('tertiary')
    expect(missions[1].icon).toBe('BookOpen')
    expect(missions[1].tone).toBe('secondary')
  })

  it('substitutes a friendly description when the Activity has none', () => {
    const missions = pickTodayMissions(
      [
        makeAssignment({
          activity: {
            id: 'activity-1',
            title: 'Activitate',
            description: null,
            category: 'math',
            difficulty: 'easy',
          },
        }),
      ],
      new Set(),
      today,
    )
    expect(missions[0].description).not.toBe('')
    expect(missions[0].description).toMatch(/Misiune/i)
  })
})
