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
const getTeacherReviewQueueMock = vi.fn()
const queuePropsMock = vi.fn()

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClientMock(),
}))

vi.mock('@/features/teacher-activities/server', () => ({
  getTeacherReviewQueue: (...args: unknown[]) => getTeacherReviewQueueMock(...args),
}))

vi.mock('@/features/teacher-activities', () => ({
  TeacherReviewQueue: (props: Record<string, unknown>) => {
    queuePropsMock(props)
    return <div data-testid="teacher-review-queue">Review queue</div>
  },
}))

vi.mock('@/lib/i18n/server', () => ({
  getServerLanguage: () => Promise.resolve('ro'),
  preloadNamespaces: () => Promise.resolve({}),
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

import TeacherActivityReviewPage from './page'

beforeEach(() => {
  vi.clearAllMocks()
  createClientMock.mockReturnValue(makeSupabase())
  getTeacherReviewQueueMock.mockResolvedValue([])
})

describe('/teacher/activities/review page', () => {
  it('loads the teacher review queue for the signed-in teacher', async () => {
    const ui = await TeacherActivityReviewPage()
    render(ui)

    expect(screen.getByRole('heading', { name: /verifică răspunsuri/i })).toBeInTheDocument()
    expect(screen.getByTestId('teacher-review-queue')).toBeInTheDocument()
    expect(getTeacherReviewQueueMock).toHaveBeenCalledWith(expect.anything(), 'teacher-1')
    expect(queuePropsMock).toHaveBeenCalledWith({ items: [] })
  })

  it('redirects non-teachers to login', async () => {
    createClientMock.mockReturnValue(makeSupabase('student'))

    await expect(TeacherActivityReviewPage()).rejects.toMatchObject({
      __redirect__: '/login',
    })
  })
})
