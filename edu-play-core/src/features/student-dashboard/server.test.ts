import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getStudentDashboardData } from './server'

const getUserMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
  }),
}))

function makeBuilder<T>(result: { data: T | null; error?: unknown }) {
  const calls: string[] = []
  const builder = {
    calls,
    select: vi.fn(() => {
      calls.push('select')
      return builder
    }),
    eq: vi.fn(() => {
      calls.push('eq')
      return builder
    }),
    or: vi.fn(() => {
      calls.push('or')
      return builder
    }),
    limit: vi.fn(() => {
      calls.push('limit')
      return builder
    }),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (
      onFulfilled: (value: { data: T | null; error?: unknown }) => unknown,
    ) => Promise.resolve(result).then(onFulfilled),
  }

  return builder
}

describe('getStudentDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'student-1' } } })
  })

  it('loads the full student activity catalog without querying class names through student RLS', async () => {
    const profileBuilder = makeBuilder({
      data: {
        full_name: 'Ana Pop',
        avatar_url: null,
        date_of_birth: '2016-01-01',
        role: 'student',
      },
    })
    const studentBuilder = makeBuilder({ data: { id: 'student-1', class_id: 'class-1' } })
    const assignmentsBuilder = makeBuilder({ data: [] })
    const progressBuilder = makeBuilder({ data: [] })
    const activitiesBuilder = makeBuilder({
      data: Array.from({ length: 12 }, (_, index) => ({
        id: `activity-${index}`,
        title: `Activity ${index}`,
        category: 'math',
        difficulty: 'easy',
        thumbnail_url: null,
        is_published: true,
      })),
    })

    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') return profileBuilder
      if (table === 'students') return studentBuilder
      if (table === 'assignments') return assignmentsBuilder
      if (table === 'activity_progress') return progressBuilder
      if (table === 'activities') return activitiesBuilder
      throw new Error(`Unexpected table ${table}`)
    })

    const data = await getStudentDashboardData()

    expect(data?.variant).toBe('school-age')
    expect(fromMock).not.toHaveBeenCalledWith('classes')
    expect(activitiesBuilder.limit).not.toHaveBeenCalled()
  })
})
