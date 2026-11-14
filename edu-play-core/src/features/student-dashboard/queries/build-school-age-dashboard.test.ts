import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildQuestUnits,
  buildSchoolAgeDashboard,
  buildTodaysLessons,
} from './build-school-age-dashboard'

describe('buildQuestUnits', () => {
  it('always builds the five Quest Map nodes required by the student-home design', () => {
    const units = buildQuestUnits({
      games: [
        { id: 'math-1', category: 'math' },
        { id: 'romanian-1', category: 'romanian' },
      ],
      progress: [{ game_id: 'math-1', status: 'completed', score: 100 }],
    })

    expect(units).toHaveLength(5)
    expect(units.map((unit) => unit.label)).toEqual([
      'Matematică',
      'Română',
      'Științe',
      'Arte',
      'Engleză',
    ])
    expect(units.at(-1)).toMatchObject({
      id: 'english',
      label: 'Engleză',
      state: 'locked',
    })
  })

  it('maps current catalog categories into the Quest Map subject nodes', () => {
    const units = buildQuestUnits({
      games: [
        { id: 'literacy-1', category: 'literacy' },
        { id: 'phonics-1', category: 'phonics' },
        { id: 'vocabulary-1', category: 'vocabulary' },
        { id: 'shapes-1', category: 'shapes' },
        { id: 'colors-1', category: 'colors' },
      ],
      progress: [
        { game_id: 'literacy-1', status: 'completed', score: 100 },
        { game_id: 'phonics-1', status: 'completed', score: 100 },
        { game_id: 'vocabulary-1', status: 'completed', score: 100 },
        { game_id: 'colors-1', status: 'completed', score: 100 },
      ],
    })

    expect(units.find((unit) => unit.id === 'romanian')).toMatchObject({
      label: 'Română',
      progress: 3,
    })
    expect(units.find((unit) => unit.id === 'art')).toMatchObject({
      label: 'Arte',
      progress: 1,
    })
  })

  it('locks later catalog-backed units after the first open node for new students', () => {
    const units = buildQuestUnits({
      games: [
        { id: 'math-1', category: 'math' },
        { id: 'literacy-1', category: 'literacy' },
        { id: 'colors-1', category: 'colors' },
      ],
      progress: [],
    })

    expect(units.map((unit) => [unit.id, unit.state])).toEqual([
      ['math', 'active'],
      ['romanian', 'locked'],
      ['science', 'locked'],
      ['art', 'locked'],
      ['english', 'locked'],
    ])
  })

  it('prefers progressed units before earlier catalog fallbacks', () => {
    const units = buildQuestUnits({
      games: [
        { id: 'math-1', category: 'math' },
        { id: 'romanian-1', category: 'romanian' },
      ],
      progress: [{ game_id: 'romanian-1', status: 'in_progress', score: 20 }],
    })

    expect(units.map((unit) => [unit.id, unit.state])).toEqual([
      ['math', 'locked'],
      ['romanian', 'active'],
      ['science', 'locked'],
      ['art', 'locked'],
      ['english', 'locked'],
    ])
  })
})

describe('buildTodaysLessons', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('skips completed assignments before filling Today with playable work', () => {
    const completedGameIds = new Set(['old-1', 'old-2', 'old-3'])

    const lessons = buildTodaysLessons({
      completedGameIds,
      assignments: [
        { id: 'assignment-old-1', games: { id: 'old-1', title: 'Gata 1', category: 'math' } },
        { id: 'assignment-old-2', games: { id: 'old-2', title: 'Gata 2', category: 'math' } },
        { id: 'assignment-old-3', games: { id: 'old-3', title: 'Gata 3', category: 'math' } },
        { id: 'assignment-new', games: { id: 'new-1', title: 'Joacă azi', category: 'romanian' } },
      ],
      games: [
        { id: 'fallback-1', title: 'Rezervă 1', category: 'science' },
        { id: 'fallback-2', title: 'Rezervă 2', category: 'art' },
      ],
    })

    expect(lessons.map((lesson) => lesson.title)).toEqual([
      'Joacă azi',
      'Rezervă 1',
      'Rezervă 2',
    ])
    expect(lessons.every((lesson) => lesson.done === false)).toBe(true)
  })

  it('prioritizes assignments due today before slicing Today lessons', () => {
    const lessons = buildTodaysLessons({
      completedGameIds: new Set(),
      today: new Date('2026-05-13T10:00:00Z'),
      assignments: [
        {
          id: 'old-1',
          created_at: '2026-04-01T00:00:00Z',
          games: { id: 'old-1', title: 'Vechi 1', category: 'math' },
        },
        {
          id: 'old-2',
          created_at: '2026-04-02T00:00:00Z',
          games: { id: 'old-2', title: 'Vechi 2', category: 'math' },
        },
        {
          id: 'old-3',
          created_at: '2026-04-03T00:00:00Z',
          games: { id: 'old-3', title: 'Vechi 3', category: 'math' },
        },
        {
          id: 'today',
          activity_id: 'activity-today',
          version_id: 'version-today',
          due_date: '2026-05-13T09:00:00Z',
          created_at: '2026-05-12T00:00:00Z',
          games: { id: 'today-game', title: 'Pentru azi', category: 'science' },
        },
      ],
      games: [],
    })

    expect(lessons.map((lesson) => lesson.id)).toEqual(['today', 'old-1', 'old-2'])
    expect(lessons[0]?.href).toBe('/play/activity-today?assignmentId=today')
    expect(lessons[1]?.href).toBe('/play/old-1')
  })

  it('skips feature-flag-hidden games when filling fallback Today lessons', () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '0')

    const lessons = buildTodaysLessons({
      completedGameIds: new Set(),
      assignments: [],
      games: [
        {
          id: 'listen-tap',
          title: 'Ascultă și atinge',
          category: 'romanian',
          game_url: '/games/listen-tap/index.html',
        },
        {
          id: 'visible-1',
          title: 'Vizibil 1',
          category: 'math',
          game_url: '/games/math/index.html',
        },
        {
          id: 'visible-2',
          title: 'Vizibil 2',
          category: 'science',
          game_url: '/games/science/index.html',
        },
      ],
    })

    expect(lessons.map((lesson) => lesson.id)).toEqual(['visible-1', 'visible-2'])
  })
})

describe('buildSchoolAgeDashboard', () => {
  it('counts weekly XP only from progress played during the current week', () => {
    const dashboard = buildSchoolAgeDashboard({
      profile: {
        full_name: 'Ana',
        avatar_url: null,
      },
      className: 'Clasa a II-a',
      today: new Date('2026-05-13T10:00:00Z'),
      games: [{ id: 'math-1', title: 'Matematică', category: 'math' }],
      assignments: [],
      progress: [
        {
          game_id: 'last-week',
          status: 'completed',
          score: 900,
          last_played_at: '2026-05-10T12:00:00Z',
        },
        {
          game_id: 'this-week',
          status: 'completed',
          score: 120,
          last_played_at: '2026-05-11T00:00:00Z',
        },
        {
          game_id: 'no-date',
          status: 'completed',
          score: 60,
          last_played_at: null,
        },
      ],
    })

    expect(dashboard.stats.weeklyXp).toBe(120)
  })
})
