import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirectError = (path: string) => {
  const err = new Error(`NEXT_REDIRECT:${path}`)
  ;(err as Error & { __redirect__: string }).__redirect__ = path
  return err
}

const redirectMock = vi.fn((path: string) => {
  throw redirectError(path)
})
const createClientMock = vi.fn()
const getPublishedGamesMock = vi.fn()
const getTeacherOwnedActivitiesMock = vi.fn()
const hubPropsMock = vi.fn()

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClientMock(),
}))

vi.mock('@/features/games/server', () => ({
  getPublishedGames: () => getPublishedGamesMock(),
}))

vi.mock('@/features/teacher-activities/server', () => ({
  getTeacherOwnedActivities: (...args: unknown[]) => getTeacherOwnedActivitiesMock(...args),
}))

vi.mock('@/features/teacher-activities', () => ({
  TeacherActivitiesHub: (props: Record<string, unknown>) => {
    hubPropsMock(props)
    return <div data-testid="teacher-activities-hub">Hub</div>
  },
}))

vi.mock('@/lib/i18n/server', () => ({
  getServerLanguage: () => Promise.resolve('ro'),
  preloadNamespaces: () => Promise.resolve({}),
  getServerTranslation: (_lang: string, _ns: string, key: string) => Promise.resolve(key),
}))

vi.mock('@/lib/i18n/I18nProvider', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

function makeSupabase(profileRole = 'teacher') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'teacher-1' } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: profileRole } }),
    })),
  }
}

import TeacherActivitiesPage from './page'

beforeEach(() => {
  vi.clearAllMocks()
  createClientMock.mockReturnValue(makeSupabase())
  getPublishedGamesMock.mockResolvedValue([])
  getTeacherOwnedActivitiesMock.mockResolvedValue([])
})

describe('/teacher/activities page', () => {
  it('passes query params into the My activities draft view', async () => {
    const ui = await TeacherActivitiesPage({
      searchParams: Promise.resolve({ tab: 'my', status: 'draft' }),
    })
    render(ui)

    expect(screen.getByTestId('teacher-activities-hub')).toBeInTheDocument()
    expect(hubPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activeTab: 'my',
        statusFilter: 'draft',
      }),
    )
    expect(getTeacherOwnedActivitiesMock).toHaveBeenCalledWith(
      expect.anything(),
      'teacher-1',
    )
  })

  it('defaults to the public library tab', async () => {
    const ui = await TeacherActivitiesPage({ searchParams: Promise.resolve({}) })
    render(ui)

    expect(hubPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activeTab: 'library',
        statusFilter: 'all',
      }),
    )
  })

  it('redirects unauthenticated visitors to login', async () => {
    createClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    await expect(TeacherActivitiesPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      __redirect__: '/login',
    })
  })

  it('shows an alert when the public library fails to load', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getPublishedGamesMock.mockRejectedValue(new Error('boom'))

    render(await TeacherActivitiesPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('alert')).toHaveTextContent('activities.libraryLoadError')
    errorSpy.mockRestore()
  })
})
