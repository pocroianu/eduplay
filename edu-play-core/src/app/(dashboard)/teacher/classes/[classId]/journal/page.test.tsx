import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROUTES } from '@/shared/lib/constants'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentPropsWithoutRef<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`)
})

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
  notFound: () => notFoundMock(),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: ComponentPropsWithoutRef<'div'>) => (
      <div {...props}>{children}</div>
    ),
    create: (Component: unknown) => Component,
  },
  useReducedMotion: () => true,
}))

const getClassDetailDataMock = vi.fn()

vi.mock('@/features/teacher-dashboard/server', () => ({
  getClassDetailData: (classId: string) => getClassDetailDataMock(classId),
}))

vi.mock('@/lib/i18n/server', () => ({
  getServerLanguage: () => Promise.resolve('ro'),
  preloadNamespaces: () => Promise.resolve({}),
}))

vi.mock('@/lib/i18n/I18nProvider', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import ClassJournalPage from './page'

const classDetailData = {
  profile: {
    id: 'teacher-1',
    full_name: 'Prof. Maria Ionescu',
    email: 'maria@example.com',
    role: 'teacher',
    avatar_url: null,
  },
  classData: {
    id: 'class-1',
    name: 'Clasa Buburuzelor',
    description: 'Grupa de dimineață',
    grade_level: 'Clasa I',
    school_year: '2025-2026',
    is_active: true,
  },
  stats: {
    totalStudents: 2,
    activeStudents: 1,
    lessonsInProgress: 1,
    awardsToday: 0,
  },
  studentRoster: [
    {
      id: 'student-1',
      fullName: 'Andrei Popescu',
      username: 'andrei.popescu',
      avatarUrl: null,
      status: 'online',
      recentGameTitle: 'Citire',
      recentGameTime: null,
      lessonProgress: 50,
      totalScore: 120,
    },
    {
      id: 'student-2',
      fullName: 'Ioana Marin',
      username: 'ioana.marin',
      avatarUrl: null,
      status: 'offline',
      recentGameTitle: null,
      recentGameTime: null,
      lessonProgress: 0,
      totalScore: 0,
    },
  ],
  leaderboard: [],
} as const

beforeEach(() => {
  redirectMock.mockClear()
  notFoundMock.mockClear()
  getClassDetailDataMock.mockReset()
})

describe('/teacher/classes/[classId]/journal', () => {
  it('adds teacher class tab route constants', () => {
    expect(ROUTES.TEACHER.CLASS_JOURNAL('class-1')).toBe('/teacher/classes/class-1/journal')
    expect(ROUTES.TEACHER.CLASS_ACTIVITIES('class-1')).toBe('/teacher/classes/class-1/activities')
    expect(ROUTES.TEACHER.CLASS_GRADEBOOK('class-1')).toBe('/teacher/classes/class-1/gradebook')
    expect(ROUTES.TEACHER.CLASS_NOTIFICATIONS('class-1')).toBe('/teacher/classes/class-1/notifications')
  })

  it('redirects unauthenticated teachers to login', async () => {
    getClassDetailDataMock.mockResolvedValue(null)

    await expect(
      ClassJournalPage({ params: Promise.resolve({ classId: 'class-1' }) }),
    ).rejects.toThrowError(/NEXT_REDIRECT:\/login/)
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('returns notFound when the class is missing', async () => {
    getClassDetailDataMock.mockResolvedValue('not-found')

    await expect(
      ClassJournalPage({ params: Promise.resolve({ classId: 'missing' }) }),
    ).rejects.toThrowError(/NEXT_NOT_FOUND/)
    expect(notFoundMock).toHaveBeenCalled()
  })

  it('renders the protected journal tab with Seesaw-style roster data and route links', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      <MantineProvider>
        {await ClassJournalPage({ params: Promise.resolve({ classId: 'class-1' }) })}
      </MantineProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Clasa Buburuzelor' })).toBeInTheDocument()
    expect(screen.getByText('Filtru flux elevi')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jurnalul clasei' })).toBeInTheDocument()
    expect(screen.getAllByText('Andrei Popescu').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ioana Marin').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Fluxul jurnalului clasei' })).toBeInTheDocument()
    expect(screen.getByText('Toată lumea')).toBeInTheDocument()
    expect(screen.getAllByText(/22 mai 2026/).length).toBeGreaterThan(0)
    const tabNavigation = screen.getByRole('navigation', {
      name: 'Filele clasei Clasa Buburuzelor',
    })

    expect(within(tabNavigation).getByRole('link', { name: /jurnal/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_JOURNAL('class-1'),
    )
    expect(within(tabNavigation).getByRole('link', { name: /activități/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_ACTIVITIES('class-1'),
    )
    expect(within(tabNavigation).getByRole('link', { name: /catalog/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_GRADEBOOK('class-1'),
    )
    expect(within(tabNavigation).getByRole('link', { name: /notificări/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_NOTIFICATIONS('class-1'),
    )
    expect(screen.getByRole('link', { name: /^adaugă$/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_JOURNAL_NEW('class-1'),
    )
    expect(screen.queryByRole('button', { name: 'Așteaptă aprobare' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apreciază' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comentează' })).toBeInTheDocument()
  })
})
