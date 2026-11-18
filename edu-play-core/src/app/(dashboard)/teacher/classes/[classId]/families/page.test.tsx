import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
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

const getClassDetailDataMock = vi.fn()

vi.mock('@/features/teacher-dashboard/server', () => ({
  getClassDetailData: (classId: string) => getClassDetailDataMock(classId),
}))

vi.mock('@/lib/i18n/server', () => ({
  getServerLanguage: () => Promise.resolve('en'),
  preloadNamespaces: () => Promise.resolve({}),
  getServerTranslation: (_lang: string, _namespace: string, key: string) =>
    Promise.resolve({
      'families.back': 'Back to settings',
      'families.heading': 'Invite Parents and Families',
      'families.loading': 'Prepare family invitations for each student.',
      'families.connectTitle': "Help families connect to their child's learning!",
      'families.benefit1': "Families see all posts in their child's journal",
      'families.benefit2': 'Families get notified about new posts',
      'families.benefit3': 'Families get a clear connection setup flow',
      'families.benefit4': 'Families can follow learning updates from home.',
      'families.turnOn': 'Turn on family access',
      'families.learnMore': 'Learn more',
      'families.students': 'Students',
      'families.infoTitle': 'Family access',
      'families.infoDescription': 'Family connection records are not available yet. Turn on access before marking families as connected.',
      'families.statusTitle': 'Invite needed',
      'families.statusDescription': 'No family connection is recorded yet.',
      'families.statusPill': 'Needs invite',
      'families.emptyStudents': 'Add students before preparing family invitations.',
    }[key] ?? key),
}))

vi.mock('@/lib/i18n/I18nProvider', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import ClassFamiliesPage from './page'

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
    lessonsInProgress: 0,
    awardsToday: 0,
  },
  studentRoster: [
    {
      id: 'student-1',
      fullName: 'Andrei Popescu',
      username: 'andrei.popescu',
      avatarUrl: null,
      status: 'online',
      recentGameTitle: null,
      recentGameTime: null,
      lessonProgress: 0,
      totalScore: 0,
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

describe('/teacher/classes/[classId]/families', () => {
  it('adds a teacher class families route constant', () => {
    expect(ROUTES.TEACHER.CLASS_FAMILIES('class-1')).toBe('/teacher/classes/class-1/families')
  })

  it('redirects unauthenticated teachers to login', async () => {
    getClassDetailDataMock.mockResolvedValue(null)

    await expect(
      ClassFamiliesPage({ params: Promise.resolve({ classId: 'class-1' }) }),
    ).rejects.toThrowError(/NEXT_REDIRECT:\/login/)
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('returns notFound when the class is missing', async () => {
    getClassDetailDataMock.mockResolvedValue('not-found')

    await expect(
      ClassFamiliesPage({ params: Promise.resolve({ classId: 'missing' }) }),
    ).rejects.toThrowError(/NEXT_NOT_FOUND/)
    expect(notFoundMock).toHaveBeenCalled()
  })

  it('renders the Add Families reference flow with real roster data', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      <MantineProvider>
        {await ClassFamiliesPage({ params: Promise.resolve({ classId: 'class-1' }) })}
      </MantineProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Invite Parents and Families' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to settings/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_SETTINGS('class-1'),
    )
    expect(screen.getByText('Prepare family invitations for each student.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Help families connect to their child's learning!/i })).toBeInTheDocument()
    expect(screen.getByText("Families see all posts in their child's journal")).toBeInTheDocument()
    expect(screen.getByText('Families get notified about new posts')).toBeInTheDocument()
    expect(screen.getByText('Families get a clear connection setup flow')).toBeInTheDocument()
    expect(screen.getByText('Families can follow learning updates from home.')).toBeInTheDocument()
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument()
    expect(screen.getByText('Ioana Marin')).toBeInTheDocument()
    expect(screen.getByText('Accesul familiei nu poate fi activat încă.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Invite by message' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Invite needed')).toHaveLength(2)
    expect(screen.getAllByText('No family connection is recorded yet.')).toHaveLength(2)
    expect(screen.getAllByText('Needs invite')).toHaveLength(2)
    expect(screen.queryAllByRole('link', { name: 'Invite' })).toHaveLength(0)
    expect(screen.getByText('Family access')).toBeInTheDocument()
    expect(screen.getByText(/before marking families as connected/i)).toBeInTheDocument()
  })
})
